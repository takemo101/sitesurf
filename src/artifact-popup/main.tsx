import { createRoot } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { ArtifactPreview } from "@/features/artifacts/ArtifactPreview";
import type { ArtifactType } from "@/features/artifacts/types";
import { useEffect, useState } from "react";

import "@mantine/core/styles.css";

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
        // 読み取り後にストレージから削除
        chrome.storage.session.remove(key);
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

  return (
    <div style={{ height: "100vh", overflow: "hidden" }}>
      <ArtifactPreview data={data} />
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(
  <MantineProvider
    defaultColorScheme="auto"
    theme={{
      primaryColor: "indigo",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}
  >
    <PopupApp />
  </MantineProvider>,
);
