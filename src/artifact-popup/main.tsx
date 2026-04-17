import { createRoot } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import type { ArtifactType } from "@/features/artifacts/types";
import { useEffect, useRef, useState } from "react";
import { THEME_STORAGE_KEY, LEGACY_THEME_STORAGE_KEY } from "@/shared/constants";
import { MarkdownContent } from "@/features/chat/MarkdownContent";

import "@mantine/core/styles.css";
import "@/shared/hljs-theme.css";
import "@/shared/markdown.css";

interface PopupData {
  name: string;
  content: string | object;
  type: ArtifactType;
}

type ResolvedTheme = "light" | "dark";

function resolveThemeFromOS(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(saved: string | undefined): ResolvedTheme {
  if (saved === "light" || saved === "dark") return saved;
  return resolveThemeFromOS();
}

async function loadInitialTheme(): Promise<ResolvedTheme> {
  return new Promise((resolve) => {
    chrome.storage.local.get([THEME_STORAGE_KEY, LEGACY_THEME_STORAGE_KEY], (result) => {
      const saved = (result[THEME_STORAGE_KEY] ?? result[LEGACY_THEME_STORAGE_KEY]) as
        | string
        | undefined;
      resolve(resolveTheme(saved));
    });
  });
}

function useThemeSync(initial: ResolvedTheme): ResolvedTheme {
  const [theme, setTheme] = useState(initial);

  useEffect(() => {
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string,
    ) => {
      if (area !== "local") return;
      const change = changes[THEME_STORAGE_KEY] ?? changes[LEGACY_THEME_STORAGE_KEY];
      if (change) {
        setTheme(resolveTheme(change.newValue as string | undefined));
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  return theme;
}

function PopupApp({ initialTheme }: { initialTheme: ResolvedTheme }) {
  const [data, setData] = useState<PopupData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const theme = useThemeSync(initialTheme);

  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get("key");
    if (!key) {
      setError("アーティファクトデータが見つかりません");
      return;
    }
    chrome.storage.session.get(key, (result) => {
      const stored = result[key] as PopupData | undefined;
      if (stored) {
        setData(stored);
        document.title = `${stored.name} - SiteSurf`;
      } else {
        setError("アーティファクトデータが見つかりません");
      }
    });
  }, []);

  const content = error ? (
    <div style={{ padding: 24, color: "#888", textAlign: "center", marginTop: 40 }}>{error}</div>
  ) : !data ? (
    <div style={{ padding: 24, color: "#888", textAlign: "center", marginTop: 40 }}>
      読み込み中...
    </div>
  ) : (
    <PopupPreview data={data} />
  );

  return (
    <MantineProvider
      forceColorScheme={theme}
      theme={{
        primaryColor: "indigo",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {content}
    </MantineProvider>
  );
}

const preStyle: React.CSSProperties = {
  margin: 0,
  padding: 16,
  minHeight: "100vh",
  overflow: "auto",
  fontSize: 13,
  fontFamily: "monospace",
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
};

function PopupPreview({ data }: { data: PopupData }) {
  const { name, content, type } = data;
  const stringContent = typeof content === "string" ? content : JSON.stringify(content, null, 2);

  switch (type) {
    case "html":
      return <HtmlFullscreen html={stringContent} name={name} />;
    case "markdown":
      return (
        <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
          <MarkdownContent content={stringContent} />
        </div>
      );
    case "image":
      return (
        <div
          style={{
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={stringContent}
            alt={name}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          />
        </div>
      );
    case "json":
      return (
        <pre style={preStyle}>
          {typeof content === "object" ? JSON.stringify(content, null, 2) : stringContent}
        </pre>
      );
    default:
      return <pre style={preStyle}>{stringContent}</pre>;
  }
}

function HtmlFullscreen({ html, name }: { html: string; name: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isReady, setIsReady] = useState(false);
  const sandboxUrl = chrome.runtime.getURL("sandbox.html");

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.type === "sandbox-ready") {
        setIsReady(true);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (!isReady || !iframeRef.current) return;
    const renderScript = `
      document.open();
      document.write(${JSON.stringify(html)});
      document.close();
    `;
    iframeRef.current.contentWindow?.postMessage(
      { type: "exec", id: `popup-${name}`, code: renderScript },
      "*",
    );
  }, [isReady, html, name]);

  return (
    <iframe
      ref={iframeRef}
      src={sandboxUrl}
      style={{ width: "100%", height: "100vh", border: "none" }}
      sandbox="allow-scripts allow-modals allow-same-origin"
      title={name}
    />
  );
}

(async () => {
  const initialTheme = await loadInitialTheme();
  const root = createRoot(document.getElementById("root")!);
  root.render(<PopupApp initialTheme={initialTheme} />);
})();
