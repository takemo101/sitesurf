export { detectType } from "@/shared/artifact-types";
export type { ArtifactType, ArtifactEntry } from "@/shared/artifact-types";

export function getMimeType(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const MIME: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
  };
  return MIME[ext] ?? "application/octet-stream";
}
