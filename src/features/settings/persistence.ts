import type { StoragePort } from "@/ports/storage";
import type { Settings } from "./settings-store";
import { DEFAULT_MAX_TOKENS } from "@/shared/token-constants";

const STORAGE_KEY = "sitesurf_settings";
const LEGACY_STORAGE_KEY = "tandemweb_settings";

export async function loadSettings(storage: StoragePort): Promise<Settings | null> {
  const raw =
    (await storage.get<Partial<Settings>>(STORAGE_KEY)) ??
    (await storage.get<Partial<Settings>>(LEGACY_STORAGE_KEY));
  if (!raw) return null;
  return {
    ...raw,
    apiMode: raw.apiMode ?? "auto",
    apiKeyByProvider: raw.apiKeyByProvider ?? {},
    baseUrlByProvider: raw.baseUrlByProvider ?? {},
    apiModeByProvider: raw.apiModeByProvider ?? {},
    maxTokens: raw.maxTokens ?? DEFAULT_MAX_TOKENS,
    enableMcpServer: raw.enableMcpServer ?? false,
  } as Settings;
}

export async function saveSettings(storage: StoragePort, data: Settings): Promise<void> {
  await storage.set(STORAGE_KEY, data);
}
