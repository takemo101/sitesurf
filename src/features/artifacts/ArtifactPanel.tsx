import { useEffect, useState, useRef } from "react";
import { ActionIcon, Box, Group, ScrollArea, Text, Paper, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  Copy,
  Download,
  ExternalLink,
  FileCode,
  FileText,
  Globe,
  ImageIcon,
  X,
  FileJson,
  FileType,
} from "lucide-react";
import { useStore } from "@/store/index";
import type { ArtifactEntry } from "./types";
import { useDeps } from "@/shared/deps-context";
import { ArtifactPreview } from "./ArtifactPreview";

const TYPE_ICONS: Record<
  ArtifactEntry["type"],
  { icon: React.ReactNode; color: string; label: string }
> = {
  json: { icon: <FileJson size={14} />, color: "orange", label: "JSON" },
  html: { icon: <Globe size={14} />, color: "cyan", label: "HTML" },
  markdown: { icon: <FileText size={14} />, color: "blue", label: "Markdown" },
  text: { icon: <FileType size={14} />, color: "gray", label: "Text" },
  image: { icon: <ImageIcon size={14} />, color: "pink", label: "Image" },
  binary: { icon: <FileCode size={14} />, color: "teal", label: "Binary" },
};

interface ArtifactData {
  name: string;
  content: string | object;
  type: ArtifactEntry["type"];
  mimeType?: string;
}

export function ArtifactPanel() {
  const artifacts = useStore((s) => s.artifacts);
  const selectedArtifact = useStore((s) => s.selectedArtifact);
  const setArtifactPanelOpen = useStore((s) => s.setArtifactPanelOpen);
  const selectArtifact = useStore((s) => s.selectArtifact);
  const removeArtifact = useStore((s) => s.removeArtifact);
  const deps = useDeps();

  const [artifactData, setArtifactData] = useState<
    Map<string, ArtifactData & { updatedAt: number }>
  >(new Map());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const tabListRef = useRef<HTMLDivElement>(null);
  const tabViewportRef = useRef<HTMLDivElement>(null);
  const loadVersionRef = useRef(0);
  const artifactDataRef = useRef(artifactData);
  const loadingRef = useRef(loading);

  useEffect(() => {
    artifactDataRef.current = artifactData;
  }, [artifactData]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  // Scroll selected tab into view
  useEffect(() => {
    if (selectedArtifact && tabListRef.current) {
      const activeTab = tabListRef.current.querySelector(`[data-filename="${selectedArtifact}"]`);
      if (activeTab) {
        activeTab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
  }, [selectedArtifact]);

  // Load artifact contents
  useEffect(() => {
    const loadVersion = ++loadVersionRef.current;
    const latestByName = new Map(artifacts.map((artifact) => [artifact.name, artifact]));

    const loadArtifacts = async () => {
      for (const artifact of artifacts) {
        if (loadVersion !== loadVersionRef.current) return;

        const cached = artifactDataRef.current.get(artifact.name);
        if (
          (cached && cached.updatedAt === artifact.updatedAt) ||
          loadingRef.current.has(artifact.name)
        )
          continue;

        loadingRef.current = new Set(loadingRef.current).add(artifact.name);
        setLoading((prev) => new Set(prev).add(artifact.name));
        try {
          let content: string | object;
          let mimeType: string | undefined;
          // Use source (not type) to determine how to load content
          if (artifact.source === "json") {
            content = (await deps.artifactStorage.get(artifact.name)) ?? {};
          } else {
            const file = await deps.artifactStorage.getFile(artifact.name);
            if (file) {
              mimeType = file.mimeType;
              if (artifact.type === "image") {
                content = toDataUrl(file.mimeType, file.contentBase64);
              } else {
                content = new TextDecoder().decode(
                  Uint8Array.from(atob(file.contentBase64), (c) => c.charCodeAt(0)),
                );
              }
            } else {
              content = "";
            }
          }
          if (loadVersion !== loadVersionRef.current) return;
          if (latestByName.get(artifact.name)?.updatedAt !== artifact.updatedAt) continue;
          setArtifactData((prev) => {
            const next = new Map(prev);
            next.set(artifact.name, {
              name: artifact.name,
              content,
              type: artifact.type,
              mimeType,
              updatedAt: artifact.updatedAt,
            });
            return next;
          });
        } catch (e) {
          console.error("Failed to load artifact:", artifact.name, e);
        } finally {
          loadingRef.current = new Set(loadingRef.current);
          loadingRef.current.delete(artifact.name);
          setLoading((prev) => {
            const next = new Set(prev);
            next.delete(artifact.name);
            return next;
          });
        }
      }
    };
    void loadArtifacts();
  }, [artifacts, deps.artifactStorage]);

  // Cleanup removed artifacts
  useEffect(() => {
    const currentNames = new Set(artifacts.map((a) => a.name));
    setArtifactData((prev) => {
      const next = new Map(prev);
      for (const name of next.keys()) {
        if (!currentNames.has(name)) {
          next.delete(name);
        }
      }
      return next;
    });
  }, [artifacts]);

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      notifications.show({ message: "コピーしました", color: "green" });
    } catch {
      notifications.show({ message: "コピーに失敗しました", color: "red" });
    }
  };

  const handleDownload = (name: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (artifacts.length === 0) {
    return null;
  }

  const currentData = selectedArtifact ? artifactData.get(selectedArtifact) : null;

  const handlePopout = async () => {
    if (!currentData) return;
    const popupKey = `artifact-popup-${Date.now()}`;
    try {
      await chrome.storage.session.set({
        [popupKey]: {
          name: currentData.name,
          content: currentData.content,
          type: currentData.type,
        },
      });
      await chrome.windows.create({
        url: chrome.runtime.getURL(`artifact-popup/index.html?key=${popupKey}`),
        type: "popup",
        width: 1024,
        height: 768,
      });
    } catch {
      chrome.storage.session.remove(popupKey);
      notifications.show({ message: "別ウィンドウを開けませんでした", color: "red" });
    }
  };
  const selectedType = currentData?.type || "text";
  const typeInfo = TYPE_ICONS[selectedType];

  return (
    <Box
      h="100%"
      style={{
        borderLeft: "1px solid var(--mantine-color-default-border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "var(--mantine-color-body)",
      }}
    >
      {/* Header - SiteSurf style */}
      <Group
        px="sm"
        py={6}
        justify="space-between"
        style={{ borderBottom: "1px solid var(--mantine-color-default-border)", flexShrink: 0 }}
      >
        <Group gap={4}>
          <Box c={typeInfo.color}>{typeInfo.icon}</Box>
          {selectedArtifact ? (
            <Text size="sm" fw={500} truncate maw={200} style={{ fontFamily: "monospace" }}>
              {selectedArtifact}
            </Text>
          ) : (
            <Text size="sm" fw={500}>
              アーティファクト ({artifacts.length})
            </Text>
          )}
        </Group>

        <Group gap={4}>
          {currentData && (
            <Tooltip label="別ウィンドウで開く">
              <ActionIcon variant="subtle" size="sm" onClick={handlePopout}>
                <ExternalLink size={14} />
              </ActionIcon>
            </Tooltip>
          )}
          {currentData && typeof currentData.content === "string" && (
            <>
              <Tooltip label="コピー">
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={() => handleCopy(currentData.content as string)}
                >
                  <Copy size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="ダウンロード">
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={() => handleDownload(currentData.name, currentData.content as string)}
                >
                  <Download size={14} />
                </ActionIcon>
              </Tooltip>
            </>
          )}
          <Tooltip label="閉じる">
            <ActionIcon variant="subtle" size="sm" onClick={() => setArtifactPanelOpen(false)}>
              <X size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* File Tabs */}
      <Box
        style={{
          borderBottom: "1px solid var(--mantine-color-default-border)",
          flexShrink: 0,
        }}
      >
        <ScrollArea
          scrollbarSize={8}
          type="auto"
          viewportRef={tabViewportRef}
          onWheel={(e) => {
            const viewport = tabViewportRef.current;
            if (!viewport || e.deltaY === 0) return;
            viewport.scrollLeft += e.deltaY;
          }}
        >
          <Group ref={tabListRef} gap={4} px="xs" py={4} wrap="nowrap">
            {artifacts.map((artifact) => {
              const isActive = selectedArtifact === artifact.name;
              const typeConfig = TYPE_ICONS[artifact.type];
              const isLoading = loading.has(artifact.name);

              return (
                <Paper
                  key={artifact.name}
                  data-filename={artifact.name}
                  onClick={() => selectArtifact(artifact.name)}
                  px="sm"
                  py={4}
                  radius="sm"
                  style={{
                    cursor: "pointer",
                    background: isActive ? "var(--mantine-color-body)" : "transparent",
                    border: `1px solid ${isActive ? "var(--mantine-color-default-border)" : "transparent"}`,
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexShrink: 0,
                    minWidth: 60,
                    maxWidth: 160,
                  }}
                >
                  <Box c={isActive ? typeConfig.color : "dimmed"}>{typeConfig.icon}</Box>
                  <Text size="xs" fw={isActive ? 500 : 400} truncate style={{ flex: 1 }}>
                    {artifact.name}
                  </Text>
                  {isLoading && (
                    <Box
                      w={10}
                      h={10}
                      style={{
                        border: "2px solid var(--mantine-color-default-border)",
                        borderTopColor: "var(--mantine-color-indigo-5)",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                  )}
                  <ActionIcon
                    variant="transparent"
                    size="xs"
                    color="red"
                    onClick={(e) => {
                      e.stopPropagation();
                      void removeArtifact(artifact.name);
                    }}
                    style={{
                      opacity: 0,
                      transition: "opacity 0.15s",
                    }}
                    className="delete-btn"
                  >
                    <X size={10} />
                  </ActionIcon>
                </Paper>
              );
            })}
          </Group>
        </ScrollArea>
      </Box>

      {/* Content Area */}
      <Box style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
        {selectedArtifact && currentData ? (
          <ArtifactPreview data={currentData} />
        ) : (
          <Box
            h="100%"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <FileCode size={32} color="var(--mantine-color-dimmed)" opacity={0.5} />
            <Text c="dimmed" size="xs">
              ファイルを選択してください
            </Text>
          </Box>
        )}
      </Box>

      <style>{`
        .delete-btn:hover {
          opacity: 1 !important;
        }
        [data-filename]:hover .delete-btn {
          opacity: 0.7 !important;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Box>
  );
}

function toDataUrl(mimeType: string, contentBase64: string): string {
  return `data:${mimeType};base64,${contentBase64}`;
}
