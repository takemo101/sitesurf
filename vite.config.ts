import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf-8"));

// Chrome拡張のビルド後処理をViteプラグインとして統合
function chromeExtensionPlugin() {
  return {
    name: "chrome-extension",
    closeBundle() {
      const dist = "dist";

      // 1. manifest.json + icons をコピー
      mkdirSync(`${dist}/icons`, { recursive: true });
      copyFileSync("public/manifest.json", `${dist}/manifest.json`);
      for (const f of readdirSync("public/icons")) {
        copyFileSync(`public/icons/${f}`, `${dist}/icons/${f}`);
      }

      // offscreen.html をコピー
      copyFileSync("public/offscreen.html", `${dist}/offscreen.html`);

      // 2. sidepanel HTML を正しい位置に移動
      const srcHtml = `${dist}/src/sidepanel/index.html`;
      if (existsSync(srcHtml)) {
        mkdirSync(`${dist}/sidepanel`, { recursive: true });
        let html = readFileSync(srcHtml, "utf-8");
        html = html.replaceAll("../../", "../");
        writeFileSync(`${dist}/sidepanel/index.html`, html);
      }

      // 2b. artifact-popup HTML を正しい位置に移動
      const popupHtml = `${dist}/src/artifact-popup/index.html`;
      if (existsSync(popupHtml)) {
        mkdirSync(`${dist}/artifact-popup`, { recursive: true });
        let html = readFileSync(popupHtml, "utf-8");
        html = html.replaceAll("../../", "../");
        writeFileSync(`${dist}/artifact-popup/index.html`, html);
      }

      // 3. manifest の side_panel パスを確定
      const manifestPath = `${dist}/manifest.json`;
      const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
      manifest.side_panel.default_path = "sidepanel/index.html";
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

      console.log("✅ Chrome extension files ready → dist/");
    },
  };
}

function normalizePath(id: string): string {
  return id.replaceAll("\\", "/");
}

export function getManualChunk(id: string): string | undefined {
  const normalizedId = normalizePath(id);

  if (normalizedId.includes("/node_modules/")) return "vendor";

  // Offscreen document — isolated like background
  if (normalizedId.includes("/src/offscreen/")) {
    return "offscreen";
  }

  // Background service-worker modules — isolated so they never pull in the
  // heavy sidepanel/artifacts dependency tree.
  if (
    normalizedId.includes("/src/background/") ||
    normalizedId.includes("/src/adapters/chrome/") ||
    normalizedId.endsWith("/src/features/tools/extract-image.ts")
  ) {
    return "bg-tools";
  }

  // Shared utilities used by both background and sidepanel.
  if (normalizedId.includes("/src/shared/") || normalizedId.includes("/src/ports/")) {
    return "shared";
  }

  if (
    normalizedId.endsWith("/src/features/chat/InputArea.tsx") ||
    normalizedId.endsWith("/src/features/chat/ElementCard.tsx") ||
    normalizedId.endsWith("/src/features/chat/TokenUsageDisplay.tsx") ||
    normalizedId.endsWith("/src/features/chat/chat-store.ts") ||
    normalizedId.endsWith("/src/features/chat/services/console-log.ts") ||
    normalizedId.endsWith("/src/features/settings/settings-store.ts") ||
    normalizedId.endsWith("/src/features/artifacts/artifact-slice.ts")
  ) {
    return "core";
  }

  if (normalizedId.endsWith("/src/features/settings/SettingsPanel.tsx")) return "settings";
  if (normalizedId.endsWith("/src/features/artifacts/ArtifactPanel.tsx")) return "artifacts";

  if (
    normalizedId.includes("/src/sidepanel/") ||
    normalizedId.includes("/src/store/") ||
    normalizedId.includes("/src/features/sessions/") ||
    normalizedId.includes("/src/routes/") ||
    normalizedId.includes("/src/hooks/use-progressive-loading.ts") ||
    normalizedId.includes("/src/orchestration/security-audit") ||
    normalizedId.includes("/src/orchestration/SecurityAuditSettingsSection")
  ) {
    return "core";
  }

  return undefined;
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [...react(), chromeExtensionPlugin()],
  test: {
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      // Force non-DOM version: index.dom.js calls document.createElement at
      // top-level which crashes in the Chrome extension service-worker.
      "decode-named-character-reference": resolve(
        __dirname,
        "node_modules/decode-named-character-reference/index.js",
      ),
    },
  },
  build: {
    // Chrome supports modulepreload natively — disable the polyfill that
    // calls document.createElement("link") at top-level (crashes in SW).
    modulePreload: false,
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, "src/sidepanel/index.html"),
        "artifact-popup": resolve(__dirname, "src/artifact-popup/index.html"),
        background: resolve(__dirname, "src/background/index.ts"),
        offscreen: resolve(__dirname, "src/offscreen/index.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
        manualChunks: getManualChunk,
      },
    },
    target: "esnext",
    minify: false,
    sourcemap: true,
  },
  base: "./",

  lint: {
    ignorePatterns: ["dist/**", "node_modules/**"],
  },

  fmt: {
    semi: true,
    singleQuote: false,
    indentStyle: "space",
    indentWidth: 2,
    lineWidth: 120,
  },

  staged: {
    "*.{ts,tsx}": "vp check --fix",
  },
});
