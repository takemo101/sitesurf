import { useCallback, useRef, useEffect, useState } from "react";
import { useDeps } from "@/shared/deps-context";
import { useStore } from "@/store/index";
import { isExcludedUrl, getLastKnownUrl } from "@/shared/utils";
import { runAgentLoop } from "@/orchestration/agent-loop";
import { getSystemPromptV2 } from "@/features/ai";
import {
  getAgentToolDefs,
  createToolExecutorWithSkills,
  loadSkillRegistry,
} from "@/features/tools";
import { createAutoSaver } from "@/features/sessions/auto-save";
import { saveSettings } from "@/features/settings/persistence";
import { subscribeSkillRegistryReload } from "@/features/settings/skill-registry-sync";
import { createSkillRegistryRuntime } from "@/sidepanel/skill-registry-runtime";
import type { ProviderId } from "@/shared/constants";
import { SkillRegistry } from "@/shared/skill-registry";
import { createLogger } from "@/shared/logger";
import { createStorageBackedSecurityAuditLogger } from "@/features/security/audit-logger";
import { createSecurityMiddleware } from "@/features/security/middleware";

const log = createLogger("use-agent");

function notifyIfHidden(message: string): void {
  if (!document.hidden) return;
  try {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "/icons/icon-128.png",
      title: "SiteSurf",
      message,
    });
  } catch {
    // non-critical: permission may be unavailable
  }
}

export function useAgent() {
  const deps = useDeps();
  const [skillRegistry, setSkillRegistry] = useState<SkillRegistry | null>(null);
  const skillRegistryRef = useRef<SkillRegistry | null>(null);
  const skillRegistryRuntimeRef = useRef(
    createSkillRegistryRuntime(() => loadSkillRegistry(deps.storage)),
  );

  // Load skill registry asynchronously
  useEffect(() => {
    let cancelled = false;
    const runtime = createSkillRegistryRuntime(() => loadSkillRegistry(deps.storage));
    skillRegistryRuntimeRef.current = runtime;

    const reloadRegistry = () => {
      runtime.triggerReload().then((registry) => {
        if (!cancelled) {
          skillRegistryRef.current = registry;
          setSkillRegistry(registry);
        }
      });
    };

    reloadRegistry();
    const unsubscribe = subscribeSkillRegistryReload(reloadRegistry);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [deps.storage]);

  const autoSaverRef = useRef(
    createAutoSaver(
      deps.sessionStorage,
      () => ({
        activeSessionSnapshot: useStore.getState().activeSessionSnapshot,
        messages: useStore.getState().messages,
        history: useStore.getState().history,
      }),
      {
        onTitleChanged: (title) => {
          const { activeSessionSnapshot, setActiveSession, sessionList, setSessionList } =
            useStore.getState();
          if (activeSessionSnapshot) {
            setActiveSession({ ...activeSessionSnapshot, title });
            setSessionList(
              sessionList.map((s) => (s.id === activeSessionSnapshot.id ? { ...s, title } : s)),
            );
          }
        },
      },
    ),
  );
  const securityMiddlewareRef = useRef(
    createSecurityMiddleware({
      auditLogger: createStorageBackedSecurityAuditLogger(deps.storage),
    }),
  );

  const handleSend = useCallback(
    async (text: string) => {
      const state = useStore.getState();

      if (state.currentTab.url && !isExcludedUrl(state.currentTab.url)) {
        const lastUrl = getLastKnownUrl(state.messages);
        if (lastUrl !== state.currentTab.url) {
          state.addNavigationMessage({
            url: state.currentTab.url,
            title: state.currentTab.title,
          });
        }
      }

      state.addUserMessage(text, state.pendingScreenshot ?? undefined);
      state.setPendingScreenshot(null);

      const { settings, activeSessionSnapshot } = useStore.getState();
      const provider = settings.provider;
      let credentials = settings.credentials ?? undefined;
      const authProvider = deps.authProviders[provider];

      // OAuthが必要なプロバイダーで認証情報を確認・更新
      if (authProvider && credentials?.providerId === provider) {
        if (!authProvider.isValid(credentials)) {
          try {
            const refreshed = await authProvider.refresh(credentials);
            if (refreshed.ok) {
              credentials = refreshed.value;
              useStore.getState().setCredentials(credentials);
              saveSettings(deps.storage, useStore.getState().settings);
            } else {
              log.warn("credentials refresh failed", refreshed.error);
            }
          } catch (e: unknown) {
            log.warn("credentials refresh threw", e);
          }
        }
      }

      const session = activeSessionSnapshot ?? {
        id: crypto.randomUUID(),
        title: "",
        model: settings.model,
        messages: [],
        history: [],
        createdAt: new Date().toISOString(),
      };

      // Use current registry (may be empty if still loading)
      const currentRegistry =
        (await skillRegistryRuntimeRef.current.waitForReady()) ??
        skillRegistryRef.current ??
        new SkillRegistry();
      const { currentTab } = useStore.getState();
      const matchedSkills = currentRegistry.getAvailableSkills(currentTab.url);
      const systemPrompt = getSystemPromptV2({
        includeSkills: matchedSkills.length > 0,
        skills: matchedSkills,
        enableBgFetch: settings.enableBgFetch,
      });

      runAgentLoop({
        deps: {
          createAIProvider: (s) => {
            // openai-codex は常に OAuth 使用
            const isOpenAICodex = s.provider === "openai-codex";
            const shouldUseOAuth = isOpenAICodex || (!s.apiKey && credentials?.accessToken);

            return deps.createAIProvider({
              provider: s.provider as ProviderId,
              model: s.model,
              apiKey: s.apiKey || undefined,
              oauthToken: shouldUseOAuth ? credentials?.accessToken : undefined,
              baseUrl: s.baseUrl || undefined,
              apiMode: (s.apiMode as "auto" | "chat-completions" | "responses") || undefined,
              enterpriseDomain: s.enterpriseDomain || undefined,
              accountId: shouldUseOAuth ? credentials?.metadata?.accountId : undefined,
            });
          },
          browserExecutor: deps.browserExecutor,
          authProvider,
          securityMiddleware: securityMiddlewareRef.current,
        },
        chatStore: {
          setStreaming: (v) => useStore.getState().setStreaming(v),
          getAbortSignal: () => useStore.getState().getAbortSignal(),
          startNewAssistantMessage: () => useStore.getState().startNewAssistantMessage(),
          appendDelta: (t) => useStore.getState().appendDelta(t),
          appendReasoning: (t) => useStore.getState().appendReasoning(t),
          clearLastAssistantMessage: () => useStore.getState().clearLastAssistantMessage(),
          setLastMessageUsage: (u) => useStore.getState().setLastMessageUsage(u),
          addToolCall: (tc) => useStore.getState().addToolCall(tc),
          appendToolInputDelta: (id, delta) => useStore.getState().appendToolInputDelta(id, delta),
          updateToolCallArgs: (id, args) => useStore.getState().updateToolCallArgs(id, args),
          updateToolCallResult: (id, result) =>
            useStore.getState().updateToolCallResult(id, result),
          addSystemMessage: (t) => useStore.getState().addSystemMessage(t),
          addErrorMessage: (e) => useStore.getState().addErrorMessage(e),
          syncHistory: (msgs) => useStore.getState().syncHistory(msgs),
          getMessages: () => useStore.getState().messages,
          setToolNavigating: (v) => useStore.getState().setToolNavigating(v),
        },
        settings: {
          provider: settings.provider,
          model: settings.model,
          apiKey: settings.apiKey,
          baseUrl: settings.baseUrl,
          apiMode: settings.apiMode,
          enterpriseDomain: settings.enterpriseDomain,
          oauthToken: credentials?.accessToken,
          reasoningLevel: settings.reasoningLevel,
          maxTokens: settings.maxTokens,
          autoCompact: settings.autoCompact,
        },
        session,
        tools: getAgentToolDefs({
          enableBgFetch: settings.enableBgFetch,
        }),
        systemPrompt,
        autoSaver: autoSaverRef.current,
        toolExecutor: createToolExecutorWithSkills(
          currentRegistry,
          deps.artifactStorage,
          deps.storage,
        ),
        skillRegistry: currentRegistry,
        credentials,
        onCredentialsUpdate: (creds) => {
          useStore.getState().setCredentials(creds);
          saveSettings(deps.storage, useStore.getState().settings);
        },
      })
        .then(() => {
          notifyIfHidden("タスクが完了しました");
        })
        .catch((e: unknown) => {
          useStore.getState().setStreaming(false);
          useStore.getState().addErrorMessage({
            code: "agent_loop_error",
            message: e instanceof Error ? e.message : "不明なエラーが発生しました",
          });
          notifyIfHidden("エラーが発生しました");
        });
    },
    [deps, skillRegistry],
  );

  const handleStop = useCallback(() => {
    useStore.getState().abortController?.abort();
  }, []);

  return { handleSend, handleStop, skillRegistryReady: skillRegistry !== null };
}
