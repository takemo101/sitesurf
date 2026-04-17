import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Box, Stack, Text, Button, Loader } from "@mantine/core";
import { AlertCircle } from "lucide-react";
import { useStore } from "@/store/index";
import { isExcludedUrl } from "@/shared/utils";
import { InputArea } from "@/features/chat/InputArea";
import { useDeps } from "@/shared/deps-context";
import { useProgressiveLoading } from "@/hooks/use-progressive-loading";
import { ArtifactsRoute, ChatRoute, SettingsRoute, getProgressiveRouteTasks } from "@/routes";
import { initializeApp } from "./initialize";
import { useAgent } from "./hooks/use-agent";
import { Header } from "./Header";
import { TabBar } from "./TabBar";
import { ErrorBoundary } from "./ErrorBoundary";

// レスポンシブブレークポイント
const BREAKPOINT = 900;

function LoadingScreen() {
  return (
    <Stack align="center" justify="center" h="100vh">
      <Loader size="md" color="indigo" />
    </Stack>
  );
}

function SectionLoadingState({ label }: { label: string }) {
  return (
    <Stack align="center" justify="center" h="100%" p="md">
      <Loader size="sm" color="indigo" />
      <Text size="xs" c="dimmed">
        {label}
      </Text>
    </Stack>
  );
}

function InitErrorScreen({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <Stack align="center" justify="center" h="100vh" gap="md" p="xl">
      <AlertCircle size={32} color="var(--mantine-color-red-5)" />
      <Text size="sm" ta="center">
        初期化に失敗しました
      </Text>
      <Text size="xs" c="dimmed" ta="center">
        {error}
      </Text>
      <Button size="xs" onClick={onRetry}>
        再読込
      </Button>
    </Stack>
  );
}

function MainLayout() {
  const { handleSend, handleStop } = useAgent();
  const settingsOpen = useStore((s) => s.settingsOpen);
  const artifactPanelOpen = useStore((s) => s.artifactPanelOpen);
  const artifacts = useStore((s) => s.artifacts);
  const setArtifactPanelOpen = useStore((s) => s.setArtifactPanelOpen);
  const showArtifacts = artifactPanelOpen && artifacts.length > 0;

  // Keep SettingsPanel mounted after first open so Drawer close animation works.
  const [settingsEverOpened, setSettingsEverOpened] = useState(false);
  useEffect(() => {
    if (settingsOpen) setSettingsEverOpened(true);
  }, [settingsOpen]);

  const progressiveLoads = useMemo(() => getProgressiveRouteTasks(), []);

  useProgressiveLoading(progressiveLoads);

  // ウィンドウ幅を監視
  const [isWide, setIsWide] = useState(window.innerWidth >= BREAKPOINT);

  useEffect(() => {
    const handleResize = () => {
      setIsWide(window.innerWidth >= BREAKPOINT);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && useStore.getState().isStreaming) {
        handleStop();
      } else if (e.key === "Escape" && artifactPanelOpen && !isWide) {
        setArtifactPanelOpen(false);
      }
    },
    [handleStop, artifactPanelOpen, isWide, setArtifactPanelOpen],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <Stack h="100vh" gap={0} style={{ overflow: "hidden" }}>
      <Header />
      {settingsEverOpened && (
        <Suspense fallback={<SectionLoadingState label="設定を読み込み中..." />}>
          <SettingsRoute />
        </Suspense>
      )}
      <TabBar />
      <Box style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {/* チャットエリア - 常に表示 */}
        <Box
          h="100%"
          style={{
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            marginRight: isWide && showArtifacts ? "50%" : 0,
          }}
        >
          <Suspense fallback={<SectionLoadingState label="チャットを読み込み中..." />}>
            <ChatRoute onSend={handleSend} />
          </Suspense>
          <InputArea onSend={handleSend} onStop={handleStop} />
        </Box>

        {/* アーティファクトパネル */}
        {showArtifacts && (
          <Box
            style={{
              position: isWide ? "absolute" : "fixed",
              top: 0,
              right: 0,
              width: isWide ? "50%" : "100%",
              height: "100%",
              zIndex: isWide ? 1 : 100,
              background: "var(--mantine-color-body)",
            }}
          >
            {/* 狭い画面時のオーバーレイ背景 */}
            {!isWide && (
              <Box
                onClick={() => setArtifactPanelOpen(false)}
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0, 0, 0, 0.5)",
                  zIndex: -1,
                }}
              />
            )}
            <Suspense fallback={<SectionLoadingState label="アーティファクトを読み込み中..." />}>
              <ArtifactsRoute />
            </Suspense>
          </Box>
        )}
      </Box>
    </Stack>
  );
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function App({ windowId }: { windowId: number }) {
  const [initialized, setInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const deps = useDeps();

  useEffect(() => {
    useStore.getState().setWindowId(windowId);
    initializeApp(deps, windowId)
      .then(() => setInitialized(true))
      .catch((err: Error) => setInitError(err.message));
  }, []);

  useEffect(() => {
    if (!initialized) return;

    const { browserExecutor } = deps;

    const refreshTab = async () => {
      try {
        const tab = await browserExecutor.getActiveTab();
        useStore.getState().setTab({
          id: tab.id ?? null,
          tabId: tab.id ?? null,
          url: tab.url || "",
          title: tab.title || "",
        });
      } catch {}
    };

    refreshTab();

    const unsubActivated = browserExecutor.onTabActivated(() => {
      refreshTab();
    });

    const unsubUpdate = browserExecutor.onTabUpdated(async (_tabId, url) => {
      await refreshTab();
      // ストリーミング中のナビゲーションメッセージ:
      // - AI が navigate/repl ツールで遷移した場合 (isToolNavigating=true) → 抑制
      //   AI はツール結果から遷移先を既に把握しており、再通知するとループの原因になる
      // - ユーザーが手動で遷移した場合 (isToolNavigating=false) → 通知する
      const state = useStore.getState();
      if (state.isStreaming && !state.isToolNavigating && url && !isExcludedUrl(url)) {
        const tab = state.currentTab;
        state.addNavigationMessage({
          url,
          title: tab.title || getHostname(url),
        });
      }
    });

    const unsubRemove = browserExecutor.onTabRemoved(() => {
      refreshTab();
    });

    return () => {
      unsubActivated();
      unsubUpdate();
      unsubRemove();
    };
  }, [initialized, deps]);

  if (initError) {
    return <InitErrorScreen error={initError} onRetry={() => location.reload()} />;
  }
  if (!initialized) {
    return <LoadingScreen />;
  }
  return (
    <ErrorBoundary>
      <MainLayout />
    </ErrorBoundary>
  );
}
