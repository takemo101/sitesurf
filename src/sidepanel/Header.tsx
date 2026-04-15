import { useState } from "react";
import { ActionIcon, Group, Tooltip } from "@mantine/core";
import { useMantineColorScheme } from "@mantine/core";
import { FileCode, History, Monitor, Moon, Plus, Settings, Sun, Trash2 } from "lucide-react";
import { useStore } from "@/store/index";
import { THEME_STORAGE_KEY } from "@/shared/constants";
import { SessionTitle } from "@/features/sessions/SessionTitle";
import { SessionListModal } from "@/features/sessions/SessionListModal";
import { createSession, loadSessionList } from "@/features/sessions/session-store";
import type { SessionStoreDeps } from "@/features/sessions/types";
import { useDeps } from "@/shared/deps-context";
import * as port from "@/shared/port";

function useSessionStoreDeps(): SessionStoreDeps {
  const deps = useDeps();
  const windowId = useStore((s) => s.windowId);
  return {
    sessionStorage: deps.sessionStorage,
    acquireLock: async (sessionId: string) => {
      try {
        const result = await port.sendMessage({ type: "acquireLock", sessionId, windowId }, 2000);
        return { success: result.success };
      } catch {
        return { success: false };
      }
    },
    releaseLock: async (_sessionId: string) => {},
    getSessionLocks: async () => {
      try {
        const result = await port.sendMessage({ type: "getLockedSessions" }, 2000);
        return result.locks;
      } catch {
        return {};
      }
    },
  };
}

export function Header() {
  const isStreaming = useStore((s) => s.isStreaming);
  const artifacts = useStore((s) => s.artifacts);
  const artifactPanelOpen = useStore((s) => s.artifactPanelOpen);
  const toggleArtifactPanel = useStore((s) => s.toggleArtifactPanel);
  const [sessionListOpen, setSessionListOpen] = useState(false);
  const storeDeps = useSessionStoreDeps();

  const openSessionList = async () => {
    useStore.getState().setSettingsOpen(false);
    const actions = {
      setSessionList: useStore.getState().setSessionList,
      setArtifactSessionId: useStore.getState().setArtifactSessionId,
      loadSession: useStore.getState().loadSession,
      setSessionLoading: useStore.getState().setSessionLoading,
      clearAll: useStore.getState().clearAll,
    };
    await loadSessionList(storeDeps, actions);
    setSessionListOpen(true);
  };

  const handleCreateSession = async () => {
    const model = useStore.getState().settings.model;
    const actions = {
      setSessionList: useStore.getState().setSessionList,
      setArtifactSessionId: useStore.getState().setArtifactSessionId,
      loadSession: useStore.getState().loadSession,
      setSessionLoading: useStore.getState().setSessionLoading,
      clearAll: useStore.getState().clearAll,
    };
    await createSession(storeDeps, actions, model);
  };

  const handleClearChat = () => {
    useStore.getState().clearMessages();
    useStore.getState().clearHistory();
    useStore.getState().clearArtifacts();
  };

  return (
    <>
      <Group
        px="sm"
        py={6}
        justify="space-between"
        style={{ borderBottom: "1px solid var(--mantine-color-default-border)", flexShrink: 0 }}
      >
        <Group gap={4}>
          <Tooltip label="セッション一覧">
            <ActionIcon
              variant="subtle"
              size="sm"
              disabled={isStreaming}
              aria-label="セッション一覧"
              onClick={openSessionList}
            >
              <History size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="新規セッション">
            <ActionIcon
              variant="subtle"
              size="sm"
              disabled={isStreaming}
              aria-label="新規セッション"
              onClick={handleCreateSession}
            >
              <Plus size={14} />
            </ActionIcon>
          </Tooltip>
          <SessionTitle />
        </Group>
        <Group gap={4}>
          {artifacts.length > 0 && (
            <Tooltip
              label={artifactPanelOpen ? "アーティファクトを閉じる" : "アーティファクトを開く"}
            >
              <ActionIcon
                variant={artifactPanelOpen ? "filled" : "subtle"}
                size="sm"
                color={artifactPanelOpen ? "indigo" : "gray"}
                onClick={toggleArtifactPanel}
                aria-label="アーティファクト"
              >
                <FileCode size={14} />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label="会話をクリア">
            <ActionIcon
              variant="subtle"
              size="sm"
              disabled={isStreaming}
              aria-label="会話をクリア"
              onClick={handleClearChat}
            >
              <Trash2 size={14} />
            </ActionIcon>
          </Tooltip>
          <ThemeToggle />
          <Tooltip label="設定">
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={() => useStore.getState().toggleSettings()}
              aria-label="設定"
            >
              <Settings size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      <SessionListModal opened={sessionListOpen} onClose={() => setSessionListOpen(false)} />
    </>
  );
}

function ThemeToggle() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const deps = useDeps();

  const CYCLE: Record<string, "auto" | "light" | "dark"> = {
    auto: "light",
    light: "dark",
    dark: "auto",
  };

  const cycle = () => {
    const nextScheme = CYCLE[colorScheme] ?? "auto";
    setColorScheme(nextScheme);
    useStore.getState().setTheme(nextScheme);
    deps.storage.set(THEME_STORAGE_KEY, nextScheme);
  };

  const icons: Record<string, React.ReactNode> = {
    auto: <Monitor size={14} />,
    light: <Sun size={14} />,
    dark: <Moon size={14} />,
  };

  const labels: Record<string, string> = {
    auto: "システム設定に追従中",
    light: "ライトモード",
    dark: "ダークモード",
  };

  return (
    <Tooltip label={labels[colorScheme]}>
      <ActionIcon variant="subtle" size="sm" color="gray" onClick={cycle} aria-label="テーマ切替">
        {icons[colorScheme]}
      </ActionIcon>
    </Tooltip>
  );
}
