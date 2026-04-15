import { createRoot } from "react-dom/client";
import type { ArtifactType } from "@/features/artifacts/types";
import { useEffect, useRef, useState } from "react";

interface PopupData {
  name: string;
  content: string | object;
  type: ArtifactType;
}

function PopupApp() {
  const [data, setData] = useState<PopupData | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  if (error) {
    return (
      <div style={{ padding: 24, color: "#888", textAlign: "center", marginTop: 40 }}>{error}</div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 24, color: "#888", textAlign: "center", marginTop: 40 }}>
        読み込み中...
      </div>
    );
  }

  return <PopupPreview data={data} />;
}

function PopupPreview({ data }: { data: PopupData }) {
  const { name, content, type } = data;
  const stringContent = typeof content === "string" ? content : JSON.stringify(content, null, 2);

  switch (type) {
    case "html":
      return <HtmlFullscreen html={stringContent} name={name} />;
    case "markdown":
      return <MarkdownFullscreen markdown={stringContent} />;
    case "image":
      return (
        <div
          style={{
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#1a1a1a",
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
        <pre
          style={{
            margin: 0,
            padding: 16,
            height: "100vh",
            overflow: "auto",
            fontSize: 13,
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {typeof content === "object" ? JSON.stringify(content, null, 2) : stringContent}
        </pre>
      );
    default:
      return (
        <pre
          style={{
            margin: 0,
            padding: 16,
            height: "100vh",
            overflow: "auto",
            fontSize: 13,
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {stringContent}
        </pre>
      );
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

function MarkdownFullscreen({ markdown }: { markdown: string }) {
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
    // Markdownをシンプルなスタイル付きHTMLとして描画
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 24px; color: #333; }
pre { background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; }
code { background: #f5f5f5; padding: 2px 4px; border-radius: 2px; font-size: 0.9em; }
pre code { background: none; padding: 0; }
blockquote { border-left: 3px solid #ddd; margin: 0; padding-left: 16px; color: #666; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
th { background: #f5f5f5; }
img { max-width: 100%; }
@media (prefers-color-scheme: dark) {
  body { color: #e0e0e0; background: #1a1a1a; }
  pre, code { background: #2a2a2a; }
  th { background: #2a2a2a; }
  th, td { border-color: #444; }
  blockquote { border-color: #555; color: #aaa; }
}
</style></head><body></body></html>`;
    const renderScript = `
      document.open();
      document.write(${JSON.stringify(html)});
      document.close();
      document.body.innerText = ${JSON.stringify(markdown)};
    `;
    iframeRef.current.contentWindow?.postMessage(
      { type: "exec", id: "popup-markdown", code: renderScript },
      "*",
    );
  }, [isReady, markdown]);

  return (
    <iframe
      ref={iframeRef}
      src={sandboxUrl}
      style={{ width: "100%", height: "100vh", border: "none" }}
      sandbox="allow-scripts allow-modals allow-same-origin"
      title="Markdown Preview"
    />
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<PopupApp />);
