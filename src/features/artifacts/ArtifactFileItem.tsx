import { ActionIcon, Box, Text, UnstyledButton } from "@mantine/core";
import { Braces, File, FileText, Globe, ImageIcon, Trash2 } from "lucide-react";
import { useStore } from "@/store/index";
import type { ArtifactEntry } from "./types";

const TYPE_ICONS: Record<ArtifactEntry["type"], React.ReactNode> = {
  json: <Braces size={14} />,
  html: <Globe size={14} />,
  markdown: <FileText size={14} />,
  text: <FileText size={14} />,
  image: <ImageIcon size={14} />,
  binary: <File size={14} />,
};

function kindLabel(source: ArtifactEntry["source"]): string {
  return source === "json" ? "JSON 値" : "ファイル";
}

export function ArtifactFileItem({
  artifact,
  selected,
}: {
  artifact: ArtifactEntry;
  selected: boolean;
}) {
  const selectArtifact = useStore((s) => s.selectArtifact);
  const removeArtifact = useStore((s) => s.removeArtifact);

  return (
    <UnstyledButton
      onClick={() => selectArtifact(artifact.name)}
      px="sm"
      py={8}
      style={{
        background: selected ? "var(--mantine-color-indigo-light)" : undefined,
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        borderLeft: selected ? "2px solid var(--mantine-color-indigo-5)" : "2px solid transparent",
      }}
      className="hover-highlight"
    >
      <Box
        c={selected ? "indigo" : "dimmed"}
        style={{ flexShrink: 0 }}
        title={kindLabel(artifact.source)}
      >
        {TYPE_ICONS[artifact.type]}
      </Box>
      <Text size="xs" truncate style={{ flex: 1 }} fw={selected ? 500 : 400}>
        {artifact.name}
      </Text>
      <Text
        size="10"
        c="dimmed"
        style={{ flexShrink: 0, textTransform: "uppercase", letterSpacing: 0.5 }}
        data-testid="artifact-kind-badge"
      >
        {artifact.source}
      </Text>
      <ActionIcon
        variant="subtle"
        size="xs"
        color="red"
        className="show-on-hover"
        onClick={(e) => {
          e.stopPropagation();
          void removeArtifact(artifact.name);
        }}
      >
        <Trash2 size={12} />
      </ActionIcon>
    </UnstyledButton>
  );
}
