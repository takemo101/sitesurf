export type ArtifactType = "json" | "html" | "markdown" | "text" | "image" | "binary";

export interface ArtifactEntry {
  name: string;
  type: ArtifactType;
  source: "json" | "file";
  updatedAt: number;
}

const EXT_MAP: Record<string, ArtifactType> = {
  json: "json",
  html: "html",
  htm: "html",
  md: "markdown",
  markdown: "markdown",
  txt: "text",
  csv: "text",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  svg: "image",
};

export function detectType(name: string): ArtifactType {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MAP[ext] ?? "binary";
}
