import type { ToolDefinition } from "@/ports/ai-provider";
import type { ArtifactStoragePort } from "@/ports/artifact-storage";
import type { BrowserExecutor } from "@/ports/browser-executor";
import { ProviderRegistry } from "@/ports/runtime-provider";
import type { Result, ToolError } from "@/shared/errors";
import { ok, err } from "@/shared/errors";
import { createLogger } from "@/shared/logger";
import { assembleReplDescriptionSections } from "@/shared/repl-description-sections";
import type { SkillMatch } from "./skills/types";
import {
  BrowserJsProvider,
  NavigateProvider,
  ArtifactProvider,
  NativeInputProvider,
  FetchProvider,
} from "./providers";

const log = createLogger("repl");

// Providerレジストリのシングルトンインスタンス
let providerRegistry: ProviderRegistry | null = null;

/**
 * Providerレジストリを取得（初期化は初回呼び出し時）
 */
function getProviderRegistry(): ProviderRegistry {
  if (providerRegistry === null) {
    providerRegistry = new ProviderRegistry();
    providerRegistry.register(new BrowserJsProvider());
    providerRegistry.register(new NavigateProvider());
    providerRegistry.register(new ArtifactProvider());
    providerRegistry.register(new NativeInputProvider());
    providerRegistry.register(new FetchProvider());
  }
  return providerRegistry;
}

export interface SandboxSkillInfo {
  readonly [skillId: string]: {
    readonly name: string;
    readonly description: string;
    readonly extractors: {
      readonly [extractorId: string]: {
        readonly name: string;
        readonly description: string;
        readonly code: string;
        readonly outputSchema: string;
      };
    };
  };
}

export function formatSkillsForSandbox(matches: readonly SkillMatch[]): SandboxSkillInfo {
  const result: Record<string, SandboxSkillInfo[string]> = {};
  for (const match of matches) {
    const extractors: Record<string, SandboxSkillInfo[string]["extractors"][string]> = {};
    for (const ext of match.availableExtractors) {
      extractors[ext.id] = {
        name: ext.name,
        description: ext.description,
        code: ext.code,
        outputSchema: ext.outputSchema,
      };
    }
    result[match.skill.id] = {
      name: match.skill.name,
      description: match.skill.description,
      extractors,
    };
  }
  return result;
}

const REPL_PARAMETERS_BASE = {
  type: "object" as const,
  properties: {
    title: {
      type: "string" as const,
      description: "コードが行うことの簡潔な説明（例: 'ページタイトルを取得'）",
    },
    code: {
      type: "string" as const,
      description: "",
    },
  },
  required: ["code"] as const,
};

function codeDescription(enableBgFetch: boolean): string {
  const fns = [
    "browserjs()",
    "navigate()",
    ...(enableBgFetch ? ["bgFetch()"] : []),
    "skills",
    "Artifact Functions",
    "File Functions",
    "Native Input Functions (nativeClick, nativeDoubleClick, nativeRightClick, nativeHover, nativeFocus, nativeBlur, nativeScroll, nativeSelectText, nativeType, nativePress, nativeKeyDown, nativeKeyUp)",
  ];
  return `実行するJavaScriptコード。${fns.join(", ")} が使える。`;
}

export function buildReplToolDef(options: { enableBgFetch?: boolean } = {}): ToolDefinition {
  const enableBgFetch = options.enableBgFetch ?? true;
  return {
    name: "repl",
    description: assembleReplDescriptionSections(["AVAILABLE_FUNCTIONS", "COMMON_PATTERNS"], {
      enableBgFetch,
    }),
    parameters: {
      ...REPL_PARAMETERS_BASE,
      properties: {
        ...REPL_PARAMETERS_BASE.properties,
        code: {
          ...REPL_PARAMETERS_BASE.properties.code,
          description: codeDescription(enableBgFetch),
        },
      },
    },
  };
}

// 静的なデフォルト（bgFetch あり）。テストや ALL_TOOL_DEFS に載せる用。
// 実行時は use-agent.ts 経由で buildReplToolDef({ enableBgFetch }) を使うので、
// 設定が OFF の時は AI には bgFetch が見えない description が渡る。
export const replToolDef: ToolDefinition = buildReplToolDef({ enableBgFetch: true });

export interface UsedSkillInfo {
  skillId: string;
  skillName: string;
  extractorIds: string[];
}

interface ReplResult {
  output: string;
  returnValue?: unknown;
  files?: Array<{
    name: string;
    mimeType: string;
    size: number;
    contentBase64: string;
  }>;
  usedSkills?: UsedSkillInfo[];
}

export function detectUsedSkills(
  code: string,
  skillMatches?: readonly SkillMatch[],
): UsedSkillInfo[] {
  if (!skillMatches || skillMatches.length === 0) return [];

  const used: UsedSkillInfo[] = [];
  for (const match of skillMatches) {
    const skillId = match.skill.id;
    if (!code.includes(skillId)) continue;

    const extractorIds: string[] = [];
    for (const ext of match.availableExtractors) {
      if (code.includes(ext.id)) {
        extractorIds.push(ext.id);
      }
    }

    used.push({
      skillId,
      skillName: match.skill.name,
      extractorIds,
    });
  }
  return used;
}

let sandboxIframe: HTMLIFrameElement | null = null;
let sandboxReady = false;
let sandboxInitPromise: Promise<HTMLIFrameElement> | null = null;

function isSandboxAlive(): boolean {
  return sandboxIframe !== null && sandboxReady && sandboxIframe.isConnected;
}

function destroySandbox(): void {
  if (sandboxIframe) {
    sandboxIframe.remove();
  }
  sandboxIframe = null;
  sandboxReady = false;
  sandboxInitPromise = null;
}

function getSandbox(): Promise<HTMLIFrameElement> {
  if (isSandboxAlive()) return Promise.resolve(sandboxIframe!);

  if (sandboxInitPromise) return sandboxInitPromise;

  sandboxInitPromise = new Promise((resolve) => {
    if (sandboxIframe) {
      sandboxIframe.remove();
    }
    sandboxIframe = null;
    sandboxReady = false;

    const iframe = document.createElement("iframe");
    iframe.src = chrome.runtime.getURL("sandbox.html");
    iframe.style.display = "none";
    document.body.appendChild(iframe);
    sandboxIframe = iframe;

    const onReady = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      if (event.data?.type === "sandbox-ready") {
        window.removeEventListener("message", onReady);
        sandboxReady = true;
        sandboxInitPromise = null;
        resolve(iframe);
      }
    };
    window.addEventListener("message", onReady);
  });

  return sandboxInitPromise;
}

async function collectFiles(
  storage: ArtifactStoragePort,
  names?: Set<string>,
): Promise<ReplResult["files"]> {
  if (!names || names.size === 0) {
    return [];
  }

  const allNames = await storage.listFiles();
  const fileNames = allNames.filter((n) => names.has(n));
  const files = await Promise.all(
    fileNames.map(async (name) => {
      const file = await storage.getFile(name);
      if (!file) return null;
      return {
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        contentBase64: file.contentBase64,
      };
    }),
  );
  return files.filter((f): f is NonNullable<typeof f> => f !== null);
}

/**
 * Providerを使用してsandboxリクエストを処理する
 */
async function handleSandboxRequest(
  msg: { id: string; action: string; [key: string]: unknown },
  sandboxWindow: WindowProxy,
  browser: BrowserExecutor,
  artifactStorage: ArtifactStoragePort,
  signal?: AbortSignal,
  onReturnFile?: (name: string) => void,
  onCreateOrUpdateArtifact?: (name: string) => void,
): Promise<void> {
  const registry = getProviderRegistry();
  const provider = registry.getProvider(msg.action);

  if (!provider) {
    sandboxWindow.postMessage(
      {
        type: "sandbox-response",
        id: msg.id,
        ok: false,
        error: `Unknown action: ${msg.action}`,
      },
      "*",
    );
    return;
  }

  try {
    const result = await provider.handleRequest(
      { ...msg, id: msg.id, action: msg.action },
      { browser, artifactStorage, signal },
    );

    if (result.ok) {
      if (msg.action === "returnFile" && onReturnFile) {
        const name = (msg as { name?: string }).name;
        if (name) onReturnFile(name);
      }
      if (msg.action === "createOrUpdateArtifact" && onCreateOrUpdateArtifact) {
        const name = (msg as { name?: string }).name;
        if (name) onCreateOrUpdateArtifact(name);
      }
      sandboxWindow.postMessage(
        { type: "sandbox-response", id: msg.id, ok: true, value: result.value },
        "*",
      );
    } else {
      sandboxWindow.postMessage(
        { type: "sandbox-response", id: msg.id, ok: false, error: result.error.message },
        "*",
      );
    }
  } catch (e: unknown) {
    sandboxWindow.postMessage(
      {
        type: "sandbox-response",
        id: msg.id,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      },
      "*",
    );
  }
}

export async function executeRepl(
  browser: BrowserExecutor,
  artifactStorage: ArtifactStoragePort,
  args: { title?: string; code: string },
  skillMatches?: readonly SkillMatch[],
  onArtifactCreated?: (name: string) => void,
  signal?: AbortSignal,
  onConsoleLog?: (message: string) => void,
): Promise<Result<ReplResult, ToolError>> {
  log.debug("repl 実行", { title: args.title });

  const sandbox = await getSandbox();
  const execId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const usesBrowserjs = args.code.includes("browserjs(");

  const skills =
    skillMatches && skillMatches.length > 0 ? formatSkillsForSandbox(skillMatches) : undefined;

  let overlayTabId: number | undefined;
  if (usesBrowserjs) {
    try {
      const tab = await browser.getActiveTab();
      if (tab.id !== null) {
        overlayTabId = tab.id;
        await injectOverlay(browser, tab.id, args.title ?? "実行中...");
      }
    } catch {}
  }

  return new Promise((resolve) => {
    const returnedFileNames = new Set<string>();
    let cancelled = false;
    let finished = false;

    const checkCancelled = async (): Promise<boolean> => {
      if (cancelled) return true;
      if (overlayTabId == null) return false;
      try {
        const result = await browser.executeScript(
          overlayTabId,
          "(() => !!window.__sitesurf_cancel)()",
        );
        if (result.ok && (result.value as { value?: unknown })?.value === true) {
          cancelled = true;
          return true;
        }
      } catch {}
      return false;
    };

    const finish = async (result: Result<ReplResult, ToolError>) => {
      if (finished) return;
      finished = true;

      window.removeEventListener("message", onMessage);

      if (cancelled) {
        // キャンセル時は sandbox iframe を破棄して実行を完全に停止する。
        // 次回 getSandbox() で自動再生成される。
        destroySandbox();
      }

      if (overlayTabId != null) {
        try {
          await removeOverlay(browser, overlayTabId);
        } catch {}
      }
      resolve(result);
    };

    const onMessage = async (event: MessageEvent) => {
      if (finished) return;
      if (event.source !== sandbox.contentWindow) return;
      const msg = event.data;

      if (msg.type === "sandbox-request") {
        if (await checkCancelled()) {
          finish(err({ code: "tool_script_error", message: "ユーザーが操作をキャンセルしました" }));
          return;
        }
        await handleSandboxRequest(
          msg,
          sandbox.contentWindow!,
          browser,
          artifactStorage,
          signal,
          (name) => returnedFileNames.add(name),
          onArtifactCreated,
        );
        return;
      }

      if (msg.type === "exec-console" && msg.id === execId) {
        if (typeof msg.message === "string") {
          onConsoleLog?.(msg.message);
        }
        return;
      }

      if (msg.type === "exec-result" && msg.id === execId) {
        if (cancelled) {
          finish(err({ code: "tool_script_error", message: "ユーザーが操作をキャンセルしました" }));
          return;
        }
        const consoleLogs: string[] = msg.console ?? [];
        const files = await collectFiles(artifactStorage, returnedFileNames);
        const usedSkills = detectUsedSkills(args.code, skillMatches);
        if (msg.ok) {
          finish(
            ok({
              output: formatOutput(consoleLogs, msg.value),
              returnValue: msg.value,
              files,
              usedSkills: usedSkills.length > 0 ? usedSkills : undefined,
            }),
          );
        } else {
          finish(
            err({
              code: "tool_script_error",
              message: formatOutput(consoleLogs, undefined, msg.error),
            }),
          );
        }
      }
    };

    window.addEventListener("message", onMessage);
    sandbox.contentWindow!.postMessage({ type: "exec", id: execId, code: args.code, skills }, "*");
  });
}

function formatOutput(consoleLogs: string[], returnValue?: unknown, error?: string): string {
  let output = "";

  if (consoleLogs.length > 0) {
    output += consoleLogs.join("\n") + "\n";
  }

  if (error) {
    if (output) output += "\n";
    output += `Error: ${error}`;
  } else if (returnValue !== undefined) {
    if (output) output += "\n";
    output +=
      typeof returnValue === "object"
        ? `=> ${JSON.stringify(returnValue, null, 2)}`
        : `=> ${returnValue}`;
  }

  return output.trim() || "Code executed successfully (no output)";
}

async function injectOverlay(
  browser: BrowserExecutor,
  tabId: number,
  taskName: string,
): Promise<void> {
  const escapedName = taskName.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const code = `
    (async () => {
      if (!document.getElementById('sitesurf-overlay')) {
        window.__sitesurf_cancel = false;

        const o = document.createElement('div');
        o.id = 'sitesurf-overlay';
        o.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:2147483647;pointer-events:none;font-family:system-ui,sans-serif;';

        const s = document.createElement('div');
        s.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;overflow:hidden;';

        const l1 = document.createElement('div');
        l1.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:radial-gradient(ellipse at center,transparent 0%,transparent 50%,rgba(255,107,0,0.04) 65%,rgba(255,69,0,0.06) 80%,rgba(220,38,38,0.03) 100%);animation:tw-s1 3s ease-in-out infinite;';
        const l2 = document.createElement('div');
        l2.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:radial-gradient(ellipse at center,transparent 0%,transparent 55%,rgba(194,24,91,0.05) 70%,rgba(219,39,119,0.08) 85%,rgba(157,23,77,0.04) 100%);animation:tw-s2 4s ease-in-out infinite;';
        const l3 = document.createElement('div');
        l3.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:radial-gradient(ellipse at center,transparent 0%,transparent 60%,rgba(147,51,234,0.06) 75%,rgba(126,34,206,0.12) 88%,rgba(107,33,168,0.08) 100%);animation:tw-s3 5s ease-in-out infinite;';
        const g = document.createElement('div');
        g.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;box-shadow:inset 0 0 120px 20px rgba(126,34,206,0.08),inset 0 0 60px 10px rgba(147,51,234,0.05);animation:tw-pulse 2s ease-in-out infinite;';

        s.append(l1, l2, l3, g);

        const tb = document.createElement('div');
        tb.style.cssText = 'position:absolute;bottom:24px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:12px;padding:12px 16px;background:rgba(0,0,0,0.9);backdrop-filter:blur(8px);border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.3);pointer-events:auto;z-index:1;';
        const lb = document.createElement('span');
        lb.textContent = '${escapedName}';
        lb.style.cssText = 'color:rgba(255,255,255,0.9);font-size:14px;font-weight:500;';

        const cb = document.createElement('button');
        cb.textContent = 'キャンセル';
        cb.style.cssText = 'color:#fff;background:rgba(220,38,38,0.8);border:none;border-radius:6px;padding:6px 14px;font-size:13px;font-weight:500;cursor:pointer;transition:background 0.15s;';
        cb.onmouseenter = () => { cb.style.background = 'rgba(220,38,38,1)'; };
        cb.onmouseleave = () => { cb.style.background = 'rgba(220,38,38,0.8)'; };
        cb.onclick = () => {
          window.__sitesurf_cancel = true;
          cb.disabled = true;
          cb.textContent = 'キャンセル中...';
          cb.style.opacity = '0.6';
          cb.style.cursor = 'default';
        };

        tb.append(lb, cb);
        o.append(s, tb);

        const st = document.createElement('style');
        st.textContent = '@keyframes tw-s1{0%,100%{opacity:.8;transform:scale(1)}50%{opacity:1;transform:scale(1.02)}}@keyframes tw-s2{0%,100%{opacity:.7;transform:scale(1)}50%{opacity:.9;transform:scale(1.03)}}@keyframes tw-s3{0%,100%{opacity:.75;transform:scale(1.01)}50%{opacity:.9;transform:scale(1)}}@keyframes tw-pulse{0%,100%{box-shadow:inset 0 0 120px 20px rgba(126,34,206,0.08),inset 0 0 60px 10px rgba(147,51,234,0.05)}50%{box-shadow:inset 0 0 140px 25px rgba(126,34,206,0.11),inset 0 0 70px 12px rgba(147,51,234,0.07)}}';
        document.head.appendChild(st);
        document.body.appendChild(o);
      }
      return true;
    })()
  `;
  await browser.executeScript(tabId, code);
}

async function removeOverlay(browser: BrowserExecutor, tabId: number): Promise<void> {
  await browser.executeScript(
    tabId,
    `
    (() => {
      const o = document.getElementById('sitesurf-overlay');
      if (o) o.remove();
      delete window.__sitesurf_cancel;
      return true;
    })()
  `,
  );
}
