import type {
  AIMessage,
  AIProvider,
  AssistantContent,
  TokenUsage,
  ToolDefinition,
  UserContent,
} from "@/ports/ai-provider";
import type { AuthCredentials, AuthProvider } from "@/ports/auth-provider";
import type { BrowserExecutor } from "@/ports/browser-executor";
import type { ChatMessage, Session } from "@/ports/session-types";
import type { ToolExecutor } from "@/ports/tool-executor";
import type { AppError, Result } from "@/shared/errors";
import { createLogger } from "@/shared/logger";
import { sleep } from "@/shared/utils";
import { createSecurityMiddleware, type SecurityMiddleware } from "@/features/security/middleware";
import { convertNavigationForAPI } from "./navigation-converter";
import { calculateBackoff, isRetryable, RETRY_CONFIG } from "./retry";
import { estimateTokens } from "./context-compressor";
import { getContextBudget, type ContextBudget } from "@/features/ai/context-budget";
import { generateVisitedUrlsSection, type VisitedUrlEntry } from "@/features/ai/system-prompt-v2";
import type { SkillRegistry } from "@/shared/skill-registry";
import { buildSkillDetectionMessage, isSkillDetectionMessage } from "./skill-detector";
import { useStore } from "@/store/index";
import {
  defaultConsoleLogService,
  normalizeConsoleLogEntry,
} from "@/features/chat/services/console-log";

const log = createLogger("agent-loop");
const defaultSecurityMiddleware = createSecurityMiddleware();

export interface AgentLoopDeps {
  createAIProvider: (settings: Settings) => AIProvider;
  browserExecutor: BrowserExecutor;
  authProvider?: AuthProvider;
  securityMiddleware?: SecurityMiddleware;
}

export interface ChatActions {
  setStreaming(v: boolean): void;
  getAbortSignal(): AbortSignal | undefined;
  startNewAssistantMessage(): void;
  appendDelta(text: string): void;
  appendReasoning(text: string): void;
  clearLastAssistantMessage(): void;
  setLastMessageUsage(usage: TokenUsage): void;
  addToolCall(tc: {
    id: string;
    name: string;
    args: Record<string, unknown>;
    isRunning: boolean;
  }): void;
  appendToolInputDelta(id: string, delta: string): void;
  updateToolCallArgs(id: string, args: Record<string, unknown>): void;
  updateToolCallResult(toolId: string, result: Result<unknown, AppError>): void;
  addSystemMessage(text: string): void;
  addErrorMessage(error: AppError): void;
  syncHistory(messages: AIMessage[]): void;
  getMessages(): ChatMessage[];
  addNavigationMessage?(nav: { url: string; title: string; favicon?: string }): void;
  setToolNavigating?(v: boolean): void;
}

export interface AutoSaver {
  saveImmediately(): void;
}

export interface Settings {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  apiMode?: string;
  enterpriseDomain: string;
  oauthToken?: string;
  reasoningLevel?: string;
  maxTokens?: number;
}

export interface AgentLoopParams {
  deps: AgentLoopDeps;
  chatStore: ChatActions;
  settings: Settings;
  session: Session;
  tools: ToolDefinition[];
  systemPrompt: string;
  autoSaver: AutoSaver;
  toolExecutor: ToolExecutor;
  skillRegistry: SkillRegistry;
  credentials?: AuthCredentials;
  onCredentialsUpdate?: (creds: AuthCredentials | null) => void;
}

export type { ToolExecutor } from "@/ports/tool-executor";

const MAX_TURNS = 25;
const URL_REVISIT_THRESHOLD = 6;
const MAX_VISITED_URLS = 20;

/** 末尾スラッシュを除去してURLを正規化する */
function normalizeUrl(url: string): string {
  return url.replace(/\/$/, "");
}

/** URLからホスト名を抽出する（パース失敗時はURLをそのまま返す） */
function extractHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** 訪問済みURLの再訪問警告メッセージを生成する（再訪問でなければ null） */
export function trackVisitedUrl(
  visitedUrls: Map<string, VisitedUrlEntry>,
  url: string,
  title: string,
  method: VisitedUrlEntry["lastMethod"],
): string | null {
  const normalized = normalizeUrl(url);
  const existing = visitedUrls.get(normalized);
  const entry: VisitedUrlEntry = {
    url,
    title,
    visitedAt: Date.now(),
    visitCount: (existing?.visitCount ?? 0) + 1,
    lastMethod: method,
  };
  visitedUrls.set(normalized, entry);
  pruneVisitedUrls(visitedUrls);
  if (entry.visitCount >= URL_REVISIT_THRESHOLD) {
    return `\n\n⚠️ WARNING: This URL has already been visited ${entry.visitCount} time(s) in this session. Do NOT navigate to it again. Use the information you already collected from previous visits. If you have enough information, proceed to analysis/response instead of collecting more pages.`;
  }
  return null;
}

/** MAX_VISITED_URLS を超えたとき、訪問回数が少なく古いエントリを削除する */
export function pruneVisitedUrls(visitedUrls: Map<string, VisitedUrlEntry>): void {
  if (visitedUrls.size <= MAX_VISITED_URLS) return;
  const entries = [...visitedUrls.entries()];
  entries.sort(([, a], [, b]) => {
    if (a.visitCount !== b.visitCount) return a.visitCount - b.visitCount;
    return a.visitedAt - b.visitedAt;
  });
  const toRemove = entries.length - MAX_VISITED_URLS;
  for (let i = 0; i < toRemove; i++) {
    visitedUrls.delete(entries[i][0]);
  }
}

/** bg_fetch 結果から SPA ドメインを検出・追跡し、警告メッセージを返す */
function trackSpaDomainsFromBgFetch(spaDetectedDomains: Set<string>, toolValue: unknown): string {
  let warning = "";
  try {
    const items = Array.isArray(toolValue) ? toolValue : [toolValue];
    for (const item of items) {
      const it = item as { url?: string; spaWarning?: string };
      if (!it.url) continue;
      // spaWarning があればドメインを登録
      if (it.spaWarning) {
        spaDetectedDomains.add(new URL(it.url).hostname);
      } else {
        // spaWarning がなくても既知 SPA ドメインなら警告
        const host = new URL(it.url).hostname;
        if (spaDetectedDomains.has(host)) {
          warning += `\n\n⚠️ WARNING: The domain "${host}" was previously detected as a SPA/CSR site. bg_fetch cannot retrieve JS-rendered content from this domain. Use navigate() + read_page/browserjs() instead.`;
        }
      }
    }
  } catch {
    // Ignore
  }
  return warning;
}

function trimMessagesForContext(messages: AIMessage[], budget: ContextBudget): void {
  for (const msg of messages) {
    if (msg.role === "tool" && typeof msg.result === "string") {
      if (msg.result.includes("data:image/")) {
        msg.result = "[screenshot captured]";
      } else if (msg.result.length > budget.maxToolResultChars) {
        msg.result = msg.result.substring(0, budget.maxToolResultChars) + "\n... (truncated)";
      }
    }
  }

  while (messages.length > 4 && estimateTokens(messages) > budget.trimThreshold) {
    const oldest = messages.findIndex(
      (m, i) => i > 0 && (m.role === "tool" || m.role === "assistant"),
    );
    if (oldest > 0) {
      messages.splice(oldest, 1);
    } else {
      break;
    }
  }
}

function isContextOverflowError(error: AppError): boolean {
  const msg = error.message.toLowerCase();
  return (
    msg.includes("token") &&
    (msg.includes("exceeds") ||
      msg.includes("limit") ||
      msg.includes("too long") ||
      msg.includes("context_length"))
  );
}

export async function runAgentLoop(params: AgentLoopParams): Promise<void> {
  const {
    deps,
    chatStore,
    settings,
    session,
    tools,
    systemPrompt,
    autoSaver,
    toolExecutor,
    skillRegistry,
  } = params;
  const securityMiddleware = deps.securityMiddleware ?? defaultSecurityMiddleware;

  log.info("streamText 開始", { model: settings.model, provider: settings.provider });

  const budget = getContextBudget(settings.model, settings.maxTokens);
  log.info("context budget", {
    model: settings.model,
    windowTokens: budget.windowTokens,
    inputBudget: budget.inputBudget,
    maxToolResultChars: budget.maxToolResultChars,
    useToolResultStore: budget.useToolResultStore,
  });

  chatStore.setStreaming(true);

  // Get current URL for skill detection
  let currentUrl = "";
  try {
    const tab = await deps.browserExecutor.getActiveTab();
    currentUrl = tab.url || "";
  } catch {
    // Ignore error, continue with empty URL
  }

  // 訪問済みURL追跡: 同一URLへの繰り返しナビゲーションを検出・警告する
  const visitedUrls = new Map<string, VisitedUrlEntry>();
  // SPA と判定されたドメインの追跡: bg_fetch で SPA 警告が出たドメインを記録
  const spaDetectedDomains = new Set<string>();
  // setToolNavigating(false) の遅延タイマー。連続 navigate 時に前のタイマーをキャンセルし、
  // 後の navigate のフラグが意図せずクリアされるのを防ぐ。
  let navFlagTimer: ReturnType<typeof setTimeout> | null = null;

  let messages: AIMessage[] = buildMessagesForAPI(
    session,
    chatStore.getMessages(),
    currentUrl,
    skillRegistry,
  );

  try {
    let aiProvider = deps.createAIProvider(settings);

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      log.info("turn start", {
        turn,
        estimateTokens: estimateTokens(messages),
        messagesCount: messages.length,
      });
      let hasToolCall = false;
      let assistantText = "";
      let retryCount = 0;
      const pendingToolCalls: Array<{
        id: string;
        name: string;
        args: Record<string, unknown>;
        providerOptions?: Record<string, Record<string, unknown>>;
      }> = [];
      const pendingToolResults: Array<{
        toolCallId: string;
        toolName: string;
        result: string;
        isError: boolean;
      }> = [];
      const toolInputBuffers = new Map<
        string,
        { name: string; input: string; providerOptions?: Record<string, Record<string, unknown>> }
      >();
      const toolCallsAdded = new Set<string>();

      const executeToolCall = async (
        id: string,
        name: string,
        args: Record<string, unknown>,
        providerOptions?: Record<string, Record<string, unknown>>,
      ) => {
        log.debug("tool-call", { name, args });
        if (!toolCallsAdded.has(id)) {
          chatStore.addToolCall({ id, name, args, isRunning: true });
          toolCallsAdded.add(id);
        } else {
          chatStore.updateToolCallArgs(id, args);
        }

        const isNavTool = name === "navigate" || name === "repl";
        if (isNavTool) {
          if (navFlagTimer !== null) {
            clearTimeout(navFlagTimer);
            navFlagTimer = null;
          }
          chatStore.setToolNavigating?.(true);
        }

        let toolResult: Result<unknown, AppError>;
        try {
          toolResult = await toolExecutor(name, args, deps.browserExecutor, undefined, {
            onConsoleStart:
              name === "repl"
                ? () => {
                    defaultConsoleLogService.clear(id);
                  }
                : undefined,
            onConsoleLog:
              name === "repl"
                ? (message) => {
                    const normalized = normalizeConsoleLogEntry(message);
                    defaultConsoleLogService.append(id, {
                      level: normalized.level,
                      message: normalized.message,
                      timestamp: normalized.timestamp,
                    });
                  }
                : undefined,
          });
        } catch (e: unknown) {
          toolResult = {
            ok: false,
            error: {
              code: "tool_script_error",
              message: e instanceof Error ? e.message : String(e),
            },
          };
        } finally {
          if (isNavTool) {
            // SPA の初期ルーティング完了を待ってからフラグをクリアする。
            // DOMContentLoaded 直後に SPA がクライアントサイドリダイレクトを行い、
            // onTabUpdated が遅延発火するケースでの抑制漏れを防ぐ。
            // 連続 navigate 時は新しい setToolNavigating(true) で前のタイマーを
            // キャンセル済みなので、後の navigate のフラグが意図せずクリアされない。
            navFlagTimer = setTimeout(() => {
              navFlagTimer = null;
              chatStore.setToolNavigating?.(false);
            }, 500);
          }
        }
        pendingToolCalls.push({ id, name, args, providerOptions });
        let resultStr = toolResult.ok
          ? JSON.stringify(toolResult.value)
          : `Error: ${toolResult.error.message}`;

        const securityEnabled = useStore.getState().settings.enableSecurityMiddleware;

        if (securityEnabled && !resultStr.includes("data:image/")) {
          const securityResult = await securityMiddleware.processToolOutput(resultStr, {
            source: name,
            sessionId: session.id,
          });

          if (securityResult.alert) {
            chatStore.addSystemMessage(
              "⚠️ ツール出力内に不審な指示らしきテキストを検出したため、AI には安全な要約だけを返しました。",
            );
            const blockedPayload = {
              securityAlert: {
                kind: securityResult.alert.kind,
                confidence: securityResult.alert.confidence,
                matches: securityResult.alert.matches,
                message: securityResult.alert.message,
              },
            };
            resultStr = JSON.stringify(blockedPayload);
            toolResult = toolResult.ok
              ? { ok: true, value: blockedPayload }
              : {
                  ok: false,
                  error: {
                    code: "tool_output_blocked",
                    message: "Security middleware blocked suspicious tool output.",
                  },
                };
          }
        }

        if (resultStr.includes("data:image/")) {
          resultStr = "[screenshot captured]";
        }

        // --- ツール別ポスト処理: 訪問追跡・SPA検出・スキル再構築 ---

        let loopWarningEmitted = false;

        if (name === "navigate" && toolResult.ok) {
          const navResult = toolResult.value as { finalUrl?: string; title?: string };
          if (navResult.finalUrl) {
            const title = navResult.title || extractHostname(navResult.finalUrl);
            const warning = trackVisitedUrl(visitedUrls, navResult.finalUrl, title, "navigate");
            if (warning) {
              resultStr += warning;
              loopWarningEmitted = true;
            }
          }
        }

        if (name === "bg_fetch" && toolResult.ok) {
          resultStr += trackSpaDomainsFromBgFetch(spaDetectedDomains, toolResult.value);
          const items = Array.isArray(toolResult.value) ? toolResult.value : [toolResult.value];
          for (const item of items) {
            const it = item as { url?: string };
            if (it.url) {
              trackVisitedUrl(visitedUrls, it.url, extractHostname(it.url), "bg_fetch");
            }
          }
        }

        // navigate/repl 後のURL変化検出: スキル再構築 + repl 訪問追跡
        if (name === "navigate" || name === "repl") {
          try {
            const tab = await deps.browserExecutor.getActiveTab();
            const newUrl = tab.url || "";
            // repl 経由のナビゲーションは currentUrl と同じでも追跡する。
            // navigate ツール直接呼び出しは上で追跡済みなのでここでは repl のみ。
            if (name === "repl" && newUrl) {
              const title = tab.title || extractHostname(newUrl);
              const warning = trackVisitedUrl(visitedUrls, newUrl, title, "navigate");
              if (warning) {
                resultStr += warning;
                loopWarningEmitted = true;
              }
            }
            if (newUrl && newUrl !== currentUrl) {
              currentUrl = newUrl;
              messages = buildMessagesForAPI(
                session,
                chatStore.getMessages(),
                currentUrl,
                skillRegistry,
              );
            }
          } catch {
            // Ignore error
          }
        }

        // ループ警告が出た場合、ユーザーにもシステムメッセージで通知
        if (loopWarningEmitted) {
          chatStore.addSystemMessage(
            "⚠️ 同じページへの繰り返しアクセスを検出しました。AIに収集を終えて分析に移るよう指示しています。",
          );
        }

        chatStore.updateToolCallResult(id, toolResult);
        pendingToolResults.push({
          toolCallId: id,
          toolName: name,
          result: resultStr,
          isError: !toolResult.ok,
        });

        if (name === "repl" && toolResult.ok) {
          const prevNames = new Set(useStore.getState().artifacts.map((a) => a.name));
          await useStore.getState().loadArtifacts();
          const { artifacts } = useStore.getState();
          const newArtifact = artifacts.find((a) => !prevNames.has(a.name));
          if (newArtifact) {
            useStore.getState().selectArtifact(newArtifact.name);
            // プレビュー価値の高い HTML/Markdown だけ自動でパネルを開く。
            // JSON/画像/テキスト等は選択のみ行い、既存のパネル状態を維持する。
            if (newArtifact.type === "html" || newArtifact.type === "markdown") {
              useStore.getState().setArtifactPanelOpen(true);
            }
          }
        }
      };

      const visitedSection = generateVisitedUrlsSection([...visitedUrls.values()]);
      const effectiveSystemPrompt = visitedSection
        ? `${systemPrompt}\n\n${visitedSection}`
        : systemPrompt;

      while (retryCount <= RETRY_CONFIG.maxRetries) {
        let hasError = false;
        trimMessagesForContext(messages, budget);
        chatStore.startNewAssistantMessage();

        for await (const event of aiProvider.streamText({
          model: settings.model,
          systemPrompt: effectiveSystemPrompt,
          messages,
          tools,
          maxTokens: settings.maxTokens,
          reasoningEffort: settings.reasoningLevel as
            | "none"
            | "low"
            | "medium"
            | "high"
            | undefined,
          abortSignal: chatStore.getAbortSignal(),
        })) {
          switch (event.type) {
            case "text-delta":
              assistantText += event.text;
              chatStore.appendDelta(event.text);
              break;

            case "reasoning-delta":
              chatStore.appendReasoning(event.text);
              break;

            case "tool-input-start":
              toolInputBuffers.set(event.id, {
                name: event.name,
                input: "",
                providerOptions: event.providerOptions,
              });
              chatStore.addToolCall({ id: event.id, name: event.name, args: {}, isRunning: true });
              toolCallsAdded.add(event.id);
              break;

            case "tool-input-delta": {
              const buf = toolInputBuffers.get(event.id);
              if (buf) buf.input += event.delta;
              chatStore.appendToolInputDelta(event.id, event.delta);
              break;
            }

            case "tool-call": {
              hasToolCall = true;
              await executeToolCall(event.id, event.name, event.args, event.providerOptions);
              break;
            }

            case "finish": {
              if (
                event.finishReason === "tool-calls" &&
                toolInputBuffers.size > 0 &&
                pendingToolCalls.length === 0
              ) {
                for (const [id, buf] of toolInputBuffers) {
                  let args: Record<string, unknown> = {};
                  try {
                    args = buf.input ? JSON.parse(buf.input) : {};
                  } catch {}
                  hasToolCall = true;
                  await executeToolCall(id, buf.name, args, buf.providerOptions);
                }
                toolInputBuffers.clear();
              }
              log.debug("finish", { finishReason: event.finishReason, turn });

              // Save token usage if available
              if (event.usage) {
                chatStore.setLastMessageUsage(event.usage);
              }

              const assistantContent: AssistantContent[] = [];
              if (assistantText) {
                assistantContent.push({ type: "text", text: assistantText });
              }
              for (const tc of pendingToolCalls) {
                assistantContent.push({
                  type: "tool-call",
                  id: tc.id,
                  name: tc.name,
                  args: tc.args,
                  ...(tc.providerOptions ? { providerOptions: tc.providerOptions } : {}),
                });
              }
              if (assistantContent.length > 0) {
                messages.push({ role: "assistant", content: assistantContent });
              }
              for (const tr of pendingToolResults) {
                messages.push({ role: "tool", ...tr });
              }
              pendingToolCalls.length = 0;
              pendingToolResults.length = 0;
              break;
            }

            case "error": {
              log.error("streamText エラー", event.error);
              const refreshed = await tryAuthRefresh(event.error, params);
              if (refreshed) {
                log.info("認証リフレッシュ成功");
                aiProvider = deps.createAIProvider(settings);
                retryCount++;
                chatStore.addSystemMessage("🔄 認証を更新しました。再試行中...");
                chatStore.clearLastAssistantMessage();
                assistantText = "";
                pendingToolCalls.length = 0;
                pendingToolResults.length = 0;
                toolCallsAdded.clear();
                hasError = true;
                break;
              }

              if (isContextOverflowError(event.error)) {
                log.info("コンテキスト超過 — メッセージを圧縮してリトライ");
                chatStore.addSystemMessage(
                  "📝 コンテキストが大きすぎるため、古いメッセージを圧縮して再試行します...",
                );
                chatStore.clearLastAssistantMessage();

                while (
                  messages.length > 4 &&
                  estimateTokens(messages) > budget.compressionThreshold
                ) {
                  const idx = messages.findIndex(
                    (m, i) => i > 0 && (m.role === "tool" || m.role === "assistant"),
                  );
                  if (idx > 0) messages.splice(idx, 1);
                  else break;
                }

                retryCount++;
                hasError = true;
                assistantText = "";
                pendingToolCalls.length = 0;
                pendingToolResults.length = 0;
                toolCallsAdded.clear();
                break;
              }

              if (isRetryable(event.error) && retryCount < RETRY_CONFIG.maxRetries) {
                retryCount++;
                const delay = calculateBackoff(retryCount, event.error);
                log.info("リトライ", { retryCount, delayMs: delay });
                chatStore.addSystemMessage(
                  `⏳ リトライ中... (${retryCount}回目, ${Math.round(delay / 1000)}秒後)`,
                );
                chatStore.clearLastAssistantMessage();
                await sleep(delay);
                hasError = true;
                assistantText = "";
                pendingToolCalls.length = 0;
                pendingToolResults.length = 0;
                toolCallsAdded.clear();
              } else {
                if (isAuthError(event.error)) {
                  params.onCredentialsUpdate?.(null);
                }
                chatStore.addErrorMessage(event.error);
                return;
              }
              break;
            }
          }
          if (hasError) break;
        }
        if (!hasError) break;
      }

      if (!hasToolCall) break;
      log.debug("ツールコールあり — 次のターンへ", { turn: turn + 1 });
      autoSaver.saveImmediately();
    }
  } finally {
    log.info("streamText 終了");
    chatStore.syncHistory(messages.filter((message) => !isSkillDetectionMessage(message)));
    chatStore.setStreaming(false);
    autoSaver.saveImmediately();
  }
}

// ============= Auth Refresh =============

function isAuthError(error: AppError): boolean {
  return error.code === "ai_auth_invalid" || error.code === "auth_expired";
}

async function tryAuthRefresh(error: AppError, params: AgentLoopParams): Promise<boolean> {
  if (!isAuthError(error)) return false;

  const { deps, settings, credentials, onCredentialsUpdate } = params;
  if (!deps.authProvider || !credentials) return false;

  const result = await deps.authProvider.refresh(credentials);
  if (!result.ok) {
    log.error("認証リフレッシュ失敗", result.error);
    return false;
  }

  params.credentials = result.value;
  settings.oauthToken = result.value.accessToken;
  onCredentialsUpdate?.(result.value);
  return true;
}

// ============= Helpers =============

function chatMessageToAIMessage(msg: ChatMessage): AIMessage | null {
  switch (msg.role) {
    case "user": {
      const content: UserContent[] = [{ type: "text", text: msg.content }];
      if (msg.image) {
        const image = normalizeImageForApi(msg.image);
        content.push({ type: "image", mimeType: image.mimeType, data: image.base64 });
      }
      return { role: "user", content };
    }
    case "navigation":
      return convertNavigationForAPI(msg);
    default:
      return null;
  }
}

export function normalizeImageForApi(image: string): { mimeType: string; base64: string } {
  const value = image.trim();
  if (value.startsWith("data:image/")) {
    const comma = value.indexOf(",");
    if (comma > 0) {
      const header = value.slice(0, comma).toLowerCase();
      const base64 = value.slice(comma + 1).trim();
      const mimeMatch = /^data:(image\/[a-z0-9.+-]+)/.exec(header);
      const isBase64 = header.includes(";base64");
      if (mimeMatch && isBase64 && base64.length > 0) {
        return {
          mimeType: mimeMatch[1],
          base64,
        };
      }
    }
  }

  return {
    mimeType: "image/png",
    base64: value,
  };
}

function buildMessagesForAPI(
  session: Session,
  chatMessages: ChatMessage[],
  currentUrl: string,
  skillRegistry: SkillRegistry,
): AIMessage[] {
  const messages: AIMessage[] = [];
  const persistedHistory = session.history.filter((message) => !isSkillDetectionMessage(message));

  // 1. Session summary (if exists)
  if (session.summary) {
    messages.push({
      role: "user",
      content: [{ type: "text", text: `[過去の会話の要約]\n${session.summary.text}` }],
    });
  }

  // 2. Add session history
  messages.push(...persistedHistory);

  // 3. Add skill detection message (before user messages)
  if (currentUrl) {
    const skillMatches = skillRegistry.getAvailableSkills(currentUrl);
    const skillMessage = buildSkillDetectionMessage(skillMatches);
    if (skillMessage) {
      messages.push(skillMessage);
    }
  }

  // 4. Add new user messages (including navigation messages)
  const historyUserCount = persistedHistory.filter((m) => m.role === "user").length;
  const userMessages = chatMessages.filter((m) => m.role === "user" || m.role === "navigation");
  const newMessages = userMessages.slice(historyUserCount);

  for (const msg of newMessages) {
    const converted = chatMessageToAIMessage(msg);
    if (converted) messages.push(converted);
  }

  return messages;
}
