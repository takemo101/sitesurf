import type { AIMessage, AIProvider, TokenUsage, ToolDefinition } from "@/ports/ai-provider";
import type { AuthCredentials, AuthProvider } from "@/ports/auth-provider";
import type { BrowserExecutor } from "@/ports/browser-executor";
import type { ChatMessage, Session } from "@/ports/session-types";
import type { ToolExecutor } from "@/ports/tool-executor";
import type { AppError, Result } from "@/shared/errors";
import { createLogger } from "@/shared/logger";
import { sleep } from "@/shared/utils";
import { createSecurityMiddleware, type SecurityMiddleware } from "@/features/security/middleware";
import { calculateBackoff, isRetryable, RETRY_CONFIG } from "./retry";
import { compressIfNeeded, estimateTokens } from "./context-compressor";
import {
  buildContextBudgetBreakdown,
  getContextBudget,
  logContextBudgetSnapshot,
} from "@/features/ai/context-budget";
import { buildReplToolDef } from "@/features/tools/repl";
import {
  generateVisitedUrlsSection,
  generateSkillsSectionForLoop,
  getActiveSkillIds,
  type VisitedUrlEntry,
} from "@/features/ai";
import { prepareMessagesForTurn, trimMessagesToThreshold } from "./context-manager";
import type { SkillRegistry } from "@/shared/skill-registry";
import type { SkillMatch } from "@/shared/skill-types";
import type { ProviderId } from "@/shared/constants";
import {
  detectUrlChangeAfterNavTool,
  trackVisitedUrlsFromToolResult,
} from "./visited-url-tracker";
import { executeToolWithTracking, makeReplConsoleHooks } from "./tool-execution-pipeline";
import {
  buildAssistantMessageContent,
  buildMessagesForAPI,
  toPersistedHistory,
} from "./messages-builder";

// 既存テスト / 外部呼び出し互換のため、ここからも再エクスポートする。
export { pruneVisitedUrls, trackVisitedUrl } from "./visited-url-tracker";
export { normalizeImageForApi } from "./messages-builder";
export { toPersistedHistory };

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
  autoCompact?: boolean;
  /** true なら tool 出力を Security middleware に通す。未指定時は true と見なす */
  enableSecurityMiddleware?: boolean;
}

/**
 * artifact ストレージから最新 artifact 一覧を取得し、repl 実行前後の差分
 * 検出 / 自動選択 / 自動パネル展開を行う UI 層側フック。
 *
 * agent-loop 本体は UI state（Zustand store）を直接触らない。必要な副作用
 * はこのコールバックを通じて sidepanel 側から注入される。
 */
export interface ArtifactAutoExpandHook {
  /** repl 呼び出し直前の既知 artifact 名集合を返す */
  snapshotNames(): Set<string>;
  /**
   * ストレージの最新状態を store に再読込し、snapshot 時点になかった
   * artifact を検出したら選択・（プレビュー可能形式なら）パネル展開する。
   */
  onReplCompleted(prevNames: Set<string>): Promise<void>;
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
  skillMatches?: SkillMatch[];
  credentials?: AuthCredentials;
  onCredentialsUpdate?: (creds: AuthCredentials | null) => void;
  /**
   * context-compressor が session.summary を更新したとき、UI 側の active
   * session snapshot に同期するためのコールバック。未指定なら何もしない。
   */
  onSessionSummaryUpdate?: (session: Session) => void;
  /**
   * repl 実行後に artifact の差分を反映するためのフック。未指定なら
   * repl による自動 artifact 反映は行わない。
   */
  artifactAutoExpand?: ArtifactAutoExpandHook;
  /**
   * shownSkillIds の読み取り / 更新フック。未指定なら差分注入は無効
   * (毎ターン full skill で送信)。
   */
  getShownSkillIds?: () => ReadonlySet<string>;
  onSkillsShown?: (ids: string[]) => void;
}

export type { ToolExecutor } from "@/ports/tool-executor";

const MAX_TURNS = 25;

function shouldIncludeCommonPatternsOnTurn(
  messages: AIMessage[],
  lastTurnHadReplError: boolean,
): boolean {
  const hasAssistantTurn = messages.some((message) => message.role === "assistant");
  return !hasAssistantTurn || lastTurnHadReplError;
}

function buildToolsForTurn(
  tools: ToolDefinition[],
  options: { includeCommonPatterns: boolean },
): ToolDefinition[] {
  const enableBgFetch = tools.some((tool) => tool.name === "bg_fetch");

  return tools.map((tool) => {
    if (tool.name !== "repl") return tool;
    return buildReplToolDef({
      enableBgFetch,
      includeCommonPatterns: options.includeCommonPatterns,
    });
  });
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
    skillMatches,
  } = params;
  const securityMiddleware = deps.securityMiddleware ?? defaultSecurityMiddleware;

  log.info("streamText 開始", { model: settings.model, provider: settings.provider });

  const budget = getContextBudget(settings.model, settings.maxTokens);
  log.info("context budget", {
    model: settings.model,
    windowTokens: budget.windowTokens,
    inputBudget: budget.inputBudget,
    maxToolResultChars: budget.maxToolResultChars,
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

  let currentSession = session;
  let latestTurnToolResultIds = new Set<string>();
  let lastTurnHadReplError = false;
  const currentUserMessageCount = chatStore
    .getMessages()
    .filter((message) => message.role === "user" || message.role === "navigation").length;
  const persistedUserMessageCount = session.history.filter(
    (message) => message.role === "user",
  ).length;
  const currentSessionTurnCount = persistedUserMessageCount + currentUserMessageCount;
  let rebuiltHistoryUserCount = persistedUserMessageCount;
  let messages: AIMessage[] = buildMessagesForAPI(
    currentSession,
    chatStore.getMessages(),
    currentUrl,
    skillRegistry,
    { historyUserCount: persistedUserMessageCount },
  );

  try {
    let aiProvider = deps.createAIProvider(settings);

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const turnTools = buildToolsForTurn(tools, {
        includeCommonPatterns: shouldIncludeCommonPatternsOnTurn(messages, lastTurnHadReplError),
      });

      log.info("turn start", {
        turn,
        estimateTokens: estimateTokens(messages),
        messagesCount: messages.length,
        currentSessionTurnCount,
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

      // navigate/repl 呼び出し中だけ立てる「ツールによる遷移中」フラグのライフサイクル。
      // navFlagTimer は外側スコープ。連続 navigate 時に前回の setTimeout をキャンセルし、
      // 後発 navigate のフラグが意図せず false に戻らないようにしている。
      const beginNavFlag = (): void => {
        if (navFlagTimer !== null) {
          clearTimeout(navFlagTimer);
          navFlagTimer = null;
        }
        chatStore.setToolNavigating?.(true);
      };
      const endNavFlagAfterDelay = (): void => {
        // SPA の初期ルーティング完了を待ってからフラグをクリアする。
        // DOMContentLoaded 直後に SPA が CSR リダイレクトするケースでの抑制漏れを防ぐ。
        navFlagTimer = setTimeout(() => {
          navFlagTimer = null;
          chatStore.setToolNavigating?.(false);
        }, 500);
      };
      const notifyUserOfSecurityBlock = (): void => {
        chatStore.addSystemMessage(
          "⚠️ ツール出力内に不審な指示らしきテキストを検出したため、AI には安全な要約だけを返しました。",
        );
      };

      const executeToolCall = async (
        id: string,
        name: string,
        args: Record<string, unknown>,
        providerOptions?: Record<string, Record<string, unknown>>,
      ) => {
        // --- 1) Chat UI に「実行中」を反映 ---
        if (!toolCallsAdded.has(id)) {
          chatStore.addToolCall({ id, name, args, isRunning: true });
          toolCallsAdded.add(id);
        } else {
          chatStore.updateToolCallArgs(id, args);
        }

        // --- 2) navigate/repl は tab-update 由来の navigation message を抑制 ---
        const isNavTool = name === "navigate" || name === "repl";
        if (isNavTool) beginNavFlag();

        // repl 実行後に artifact の差分を検出するため、事前スナップショットを取る
        const replPrevNames =
          name === "repl" && params.artifactAutoExpand
            ? params.artifactAutoExpand.snapshotNames()
            : null;

        // --- 3) Security / screenshot / bg_fetch SPA 警告は pipeline 内で処理 ---
        const consoleHooks = makeReplConsoleHooks(id);
        let pipelineResult: Awaited<ReturnType<typeof executeToolWithTracking>>;
        try {
          pipelineResult = await executeToolWithTracking({
            toolCall: { id, name, args },
            browser: deps.browserExecutor,
            toolExecutor,
            securityMiddleware,
            securityEnabled: settings.enableSecurityMiddleware ?? true,
            sessionId: session.id,
            spaDetectedDomains,
            onConsoleStart: consoleHooks.onConsoleStart,
            onConsoleLog: consoleHooks.onConsoleLog,
            onSecurityBlocked: notifyUserOfSecurityBlock,
          });
        } finally {
          if (isNavTool) endNavFlagAfterDelay();
        }

        const { toolResult, fullResult } = pipelineResult;
        pendingToolCalls.push({ id, name, args, providerOptions });

        // --- 4) ツール結果から訪問 URL を追跡 ---
        trackVisitedUrlsFromToolResult(name, toolResult, visitedUrls);

        // --- 5) navigate/repl 後の URL 変化検出: スキル再構築 + repl 訪問追跡 ---
        if (isNavTool) {
          const newUrl = await detectUrlChangeAfterNavTool(
            name,
            deps.browserExecutor,
            visitedUrls,
          );
          if (newUrl && newUrl !== currentUrl) {
            currentUrl = newUrl;
            messages = buildMessagesForAPI(
              currentSession,
              chatStore.getMessages(),
              currentUrl,
              skillRegistry,
              { historyUserCount: rebuiltHistoryUserCount },
            );
          }
        }

        // --- 6) Chat UI / 履歴に結果を反映 ---
        // ツール結果はフルサイズで履歴に残す。文脈が溢れそうになったら
        // context-compressor が LLM 要約で古い部分を畳み、過大な個別メッセージは
        // context-manager の maxToolResultChars が安全弁として働く。
        chatStore.updateToolCallResult(id, toolResult);
        pendingToolResults.push({
          toolCallId: id,
          toolName: name,
          result: fullResult,
          isError: !toolResult.ok,
        });

        // --- 7) repl 後に新規 artifact があれば UI に反映（UI state 操作はフック経由） ---
        if (name === "repl" && toolResult.ok && replPrevNames && params.artifactAutoExpand) {
          await params.artifactAutoExpand.onReplCompleted(replPrevNames);
        }
      };

      const visitedSection = generateVisitedUrlsSection([...visitedUrls.values()]);
      const currentShownSkillIds = params.getShownSkillIds?.() ?? new Set<string>();
      const skillsSection =
        skillMatches && skillMatches.length > 0
          ? generateSkillsSectionForLoop(skillMatches, currentShownSkillIds)
          : "";
      const activeSkillIds =
        skillMatches && skillMatches.length > 0 ? getActiveSkillIds(skillMatches) : [];
      const effectiveSystemPrompt = [systemPrompt, skillsSection, visitedSection]
        .filter((s) => s.length > 0)
        .join("\n\n");

      while (retryCount <= RETRY_CONFIG.maxRetries) {
        let hasError = false;
        const contextResult = await prepareMessagesForTurn({
          aiProvider,
          messages,
          budget,
          model: settings.model,
          provider: settings.provider as ProviderId,
          autoCompact: settings.autoCompact,
          sessionSummary: session.summary,
        });
        messages = contextResult.messages;
        if (contextResult.summary) {
          session.summary = contextResult.summary;
          params.onSessionSummaryUpdate?.(session);
        }
        const turnBudget = {
          ...budget,
          ...buildContextBudgetBreakdown({
            systemPrompt: effectiveSystemPrompt,
            tools: turnTools,
            messages,
            latestToolResultIds: latestTurnToolResultIds,
          }),
        };
        logContextBudgetSnapshot({
          phase: "request",
          model: settings.model,
          turn,
          budget: turnBudget,
        });
        chatStore.startNewAssistantMessage();

        for await (const event of aiProvider.streamText({
          model: settings.model,
          systemPrompt: effectiveSystemPrompt,
          messages,
          tools: turnTools,
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
              logContextBudgetSnapshot({
                phase: "finish",
                model: settings.model,
                turn,
                budget: turnBudget,
                usage: event.usage,
              });

              const assistantContent = buildAssistantMessageContent(
                assistantText,
                pendingToolCalls,
              );
              if (assistantContent.length > 0) {
                messages.push({ role: "assistant", content: assistantContent });
              }
              for (const tr of pendingToolResults) {
                messages.push({ role: "tool", ...tr });
              }
              latestTurnToolResultIds = new Set(
                pendingToolResults.map((toolResult) => toolResult.toolCallId),
              );
              lastTurnHadReplError = pendingToolResults.some(
                (toolResult) => toolResult.toolName === "repl" && toolResult.isError,
              );
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
                log.info("contextOverflowError", {
                  model: settings.model,
                  provider: settings.provider,
                  errorCode: event.error.code,
                  message: event.error.message,
                });
                log.info("コンテキスト超過 — メッセージを圧縮してリトライ");
                chatStore.addSystemMessage(
                  "📝 コンテキストが大きすぎるため、古いメッセージを圧縮して再試行します...",
                );
                chatStore.clearLastAssistantMessage();

                const compressed = await compressIfNeeded(
                  aiProvider,
                  {
                    ...currentSession,
                    history: toPersistedHistory(messages, currentSession.summary?.text),
                  },
                  budget,
                  settings.model,
                  settings.provider as ProviderId,
                  { userConfirmed: settings.autoCompact },
                );

                if (compressed.compressed) {
                  currentSession = compressed.session;
                  rebuiltHistoryUserCount = currentUserMessageCount;
                  messages = buildMessagesForAPI(
                    currentSession,
                    chatStore.getMessages(),
                    currentUrl,
                    skillRegistry,
                    { historyUserCount: rebuiltHistoryUserCount },
                  );
                } else {
                  messages = trimMessagesToThreshold(messages, budget.compressionThreshold);
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

      // After successful AI response, mark the active skills as shown
      if (activeSkillIds.length > 0) {
        params.onSkillsShown?.(activeSkillIds);
      }

      if (!hasToolCall) break;
      log.debug("ツールコールあり — 次のターンへ", { turn: turn + 1 });
      autoSaver.saveImmediately();
    }
  } finally {
    log.info("streamText 終了");
    if (currentSession.summary) {
      params.onSessionSummaryUpdate?.(currentSession);
    }
    chatStore.syncHistory(toPersistedHistory(messages, currentSession.summary?.text));
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

