import { useStore } from "@/store/index";
import { loadSettings } from "@/features/settings/persistence";
import { THEME_STORAGE_KEY, LEGACY_THEME_STORAGE_KEY } from "@/shared/constants";
import { createLogger } from "@/shared/logger";
import * as port from "@/shared/port";
import type { AppDeps } from "@/shared/deps-context";

const log = createLogger("initialize");

export async function initializeApp(deps: AppDeps, windowId: number): Promise<void> {
  log.info("起動シーケンス開始", { windowId });
  const { storage, sessionStorage } = deps;

  await port.initialize(windowId);

  log.debug("テーマ復元");
  await restoreTheme(storage);
  log.debug("設定復元");
  await restoreSettings(storage);

  const currentSettings = useStore.getState().settings;
  const hasAuth =
    currentSettings.apiKey || currentSettings.credentials || currentSettings.provider === "local";
  if (!hasAuth) {
    log.info("認証情報なし — 設定画面を表示");
    useStore.getState().setSettingsOpen(true);
    await createNewSession(windowId);
    return;
  }

  log.debug("セッション復元");
  const restored = await restoreSession(sessionStorage, windowId);
  if (!restored) {
    log.info("既存セッションなし — 新規作成");
    await createNewSession(windowId);
  }
  log.info("起動シーケンス完了");
}

async function restoreTheme(storage: AppDeps["storage"]): Promise<void> {
  const savedTheme =
    (await storage.get<string>(THEME_STORAGE_KEY)) ??
    (await storage.get<string>(LEGACY_THEME_STORAGE_KEY));
  if (savedTheme === "auto" || savedTheme === "light" || savedTheme === "dark") {
    useStore.getState().setTheme(savedTheme);
  }
}

async function restoreSettings(storage: AppDeps["storage"]): Promise<void> {
  const settings = await loadSettings(storage);
  if (settings) {
    useStore.getState().hydrateSettings(settings);
  }
}

async function restoreSession(
  sessionStorage: AppDeps["sessionStorage"],
  windowId: number,
): Promise<boolean> {
  const latestId = await sessionStorage.getLatestSessionId();
  if (!latestId) return false;

  try {
    const lockResult = await port.sendMessage(
      { type: "acquireLock", sessionId: latestId, windowId },
      2000,
    );
    if (!lockResult.success) return false;
  } catch {
    return false;
  }

  const session = await sessionStorage.getSession(latestId);
  if (!session) return false;

  useStore.getState().setArtifactSessionId(session.id);
  useStore.getState().loadSession(session);
  useStore.getState().setActiveSessionId(latestId);
  return true;
}

async function createNewSession(windowId: number): Promise<void> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  useStore.getState().setArtifactSessionId(id);
  useStore.getState().setActiveSession({
    id,
    title: "",
    model: "",
    messages: [],
    history: [],
    createdAt: now,
  });

  useStore.getState().clearMessages();
  useStore.getState().clearHistory();

  try {
    await port.sendMessage({ type: "acquireLock", sessionId: id, windowId }, 2000);
  } catch {}
}
