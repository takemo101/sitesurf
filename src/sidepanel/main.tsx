import { createRoot } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";

import { OpenAICodexAdapter } from "@/adapters/ai/openai-codex-adapter";
import { VercelAIAdapter } from "@/adapters/ai/vercel-ai-adapter";
import { OpenAIAuth } from "@/adapters/auth/openai-auth";
import { CopilotAuth } from "@/adapters/auth/copilot-auth";
import { ChromeBrowserExecutor } from "@/adapters/chrome/chrome-browser-executor";
import { ChromeArtifactStorage } from "@/adapters/storage/artifact-storage";
import { ChromeStorageAdapter } from "@/adapters/storage/chrome-storage";
import { IndexedDBSessionStorage } from "@/adapters/storage/indexeddb-session-storage";
import { LEGACY_THEME_STORAGE_KEY, THEME_STORAGE_KEY, type ColorScheme } from "@/shared/constants";

import { useStore, initStore } from "@/store/index";
import { DepsProvider, type AppDeps } from "@/shared/deps-context";
import { App } from "./App";

import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./styles.css";

const VALID_SCHEMES = new Set<ColorScheme>(["auto", "light", "dark"]);

function isColorScheme(value: unknown): value is ColorScheme {
  return typeof value === "string" && VALID_SCHEMES.has(value as ColorScheme);
}

(async () => {
  // bundler (rolldown) が MantineProvider 等の共有モジュールを sidepanel.js に
  // 巻き上げるため、artifact-popup エントリからも sidepanel.js が import される。
  // このガードにより、sidepanel 以外のページでは初期化を実行しない。
  if (!location.pathname.endsWith("/sidepanel/index.html")) return;

  const browserExecutor = new ChromeBrowserExecutor();
  const storage = new ChromeStorageAdapter();
  const sessionStorage = new IndexedDBSessionStorage();
  const artifactStorage = new ChromeArtifactStorage();

  initStore(artifactStorage);

  const deps: AppDeps = {
    createAIProvider: (config) => {
      // OpenAI Codex uses a custom adapter (not Vercel AI SDK)
      if (config.provider === "openai-codex") {
        return new OpenAICodexAdapter(config.oauthToken!, config.baseUrl, config.accountId);
      }

      // Other providers use Vercel AI SDK
      return new VercelAIAdapter(config);
    },
    authProviders: {
      openai: new OpenAIAuth(browserExecutor, "openai"),
      "openai-codex": new OpenAIAuth(browserExecutor, "openai-codex"),
      copilot: new CopilotAuth(browserExecutor),
    },
    browserExecutor,
    storage,
    sessionStorage,
    artifactStorage,
  };

  if (import.meta.env.DEV) {
    const w = window as unknown as Record<string, unknown>;
    w.__sitesurf = {
      store: useStore,
      deps,
    };
    w.__tandemweb = w.__sitesurf;
  }

  const savedTheme =
    (await storage.get<string>(THEME_STORAGE_KEY)) ??
    (await storage.get<string>(LEGACY_THEME_STORAGE_KEY));
  const initialColorScheme: ColorScheme = isColorScheme(savedTheme) ? savedTheme : "auto";

  const windowId = (await chrome.windows.getCurrent()).id!;

  const root = createRoot(document.getElementById("root")!);
  root.render(
    <DepsProvider value={deps}>
      <MantineProvider
        defaultColorScheme={initialColorScheme}
        theme={{
          primaryColor: "indigo",
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          fontSizes: { xs: "13px", sm: "14px", md: "15px", lg: "16px", xl: "18px" },
          components: {
            Button: { defaultProps: { size: "xs" } },
            TextInput: { defaultProps: { size: "xs" } },
            Select: { defaultProps: { size: "xs" } },
            PasswordInput: { defaultProps: { size: "xs" } },
          },
        }}
      >
        <ModalsProvider>
          <Notifications position="top-right" />
          <App windowId={windowId} />
        </ModalsProvider>
      </MantineProvider>
    </DepsProvider>,
  );
})();
