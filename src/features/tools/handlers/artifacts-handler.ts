import type { ArtifactStoragePort } from "@/ports/artifact-storage";
import type { ArtifactEntry } from "@/shared/artifact-types";
import { detectType } from "@/shared/artifact-types";

export interface ArtifactsParams {
  command: "create" | "update" | "rewrite" | "get" | "delete" | "logs";
  filename: string;
  content?: string;
  old_str?: string;
  new_str?: string;
}

interface ArtifactSlice {
  artifacts: ArtifactEntry[];
  selectedArtifact: string | null;
  setArtifacts: (artifacts: ArtifactEntry[]) => void;
  selectArtifact: (name: string | null) => void;
  setArtifactPanelOpen: (open: boolean) => void;
}

// Tool execution handler
export async function handleArtifactsTool(
  args: ArtifactsParams,
  artifactStorage: ArtifactStoragePort,
  artifactSlice: ArtifactSlice,
  signal?: AbortSignal,
): Promise<{ content: string; isError?: boolean }> {
  // Validate args
  if (!args) {
    return { content: "Error: No arguments provided", isError: true };
  }

  if (!args.command || !args.filename) {
    return { content: "Error: command and filename are required", isError: true };
  }

  const { command, filename } = args;

  if (signal?.aborted) {
    throw new Error("Execution aborted");
  }

  try {
    switch (command) {
      case "create": {
        if (!args.content) {
          return { content: "Error: content is required for create command", isError: true };
        }

        // Check if file already exists
        const existing = artifactSlice.artifacts.find((a) => a.name === filename);
        if (existing) {
          return {
            content: `Error: File ${filename} already exists. Use 'rewrite' to replace it.`,
            isError: true,
          };
        }

        // Determine type and save
        const type = detectType(filename);
        const entry: ArtifactEntry = {
          name: filename,
          type,
          source: type === "json" ? "json" : "file",
          updatedAt: Date.now(),
        };

        if (type === "json") {
          await artifactStorage.createOrUpdate(filename, JSON.parse(args.content));
        } else {
          const contentBase64 = btoa(unescape(encodeURIComponent(args.content)));
          const mimeType = getMimeType(filename);
          await artifactStorage.saveFile(filename, contentBase64, mimeType);
        }

        // Update store
        artifactSlice.setArtifacts([...artifactSlice.artifacts, entry]);
        artifactSlice.selectArtifact(filename);

        // Auto-open panel for previewable files
        if (type === "html" || type === "markdown") {
          artifactSlice.setArtifactPanelOpen(true);
        }

        return { content: `Created file ${filename}` };
      }

      case "rewrite": {
        if (!args.content) {
          return { content: "Error: content is required for rewrite command", isError: true };
        }

        const existing = artifactSlice.artifacts.find((a) => a.name === filename);
        if (!existing) {
          return {
            content: `Error: File ${filename} not found. Use 'create' to create it first.`,
            isError: true,
          };
        }

        const type = detectType(filename);
        if (type === "json") {
          await artifactStorage.createOrUpdate(filename, JSON.parse(args.content));
        } else {
          const contentBase64 = btoa(unescape(encodeURIComponent(args.content)));
          const mimeType = getMimeType(filename);
          await artifactStorage.saveFile(filename, contentBase64, mimeType);
        }

        // Update timestamp
        const updated = artifactSlice.artifacts.map((a) =>
          a.name === filename ? { ...a, updatedAt: Date.now() } : a,
        );
        artifactSlice.setArtifacts(updated);

        return { content: `Rewrote file ${filename}` };
      }

      case "update": {
        if (args.old_str === undefined || args.new_str === undefined) {
          return {
            content: "Error: old_str and new_str are required for update command",
            isError: true,
          };
        }

        const existing = artifactSlice.artifacts.find((a) => a.name === filename);
        if (!existing) {
          return { content: `Error: File ${filename} not found`, isError: true };
        }

        // Get current content
        let currentContent: string;
        if (existing.type === "json") {
          const data = await artifactStorage.get(filename);
          currentContent = data ? JSON.stringify(data, null, 2) : "";
        } else {
          const file = await artifactStorage.getFile(filename);
          if (!file || !file.contentBase64) {
            return { content: `Error: Could not read file ${filename}`, isError: true };
          }
          currentContent = decodeURIComponent(escape(atob(file.contentBase64)));
        }

        // Check if old_str exists
        if (!args.old_str || !currentContent.includes(args.old_str)) {
          return {
            content: `Error: String not found in file. Here is the full content:\n\n${currentContent}`,
            isError: true,
          };
        }

        // Apply update
        const newContent = currentContent.replace(args.old_str, args.new_str);

        if (existing.type === "json") {
          await artifactStorage.createOrUpdate(filename, JSON.parse(newContent));
        } else {
          const contentBase64 = btoa(unescape(encodeURIComponent(newContent)));
          const mimeType = getMimeType(filename);
          await artifactStorage.saveFile(filename, contentBase64, mimeType);
        }

        // Update timestamp
        const updated = artifactSlice.artifacts.map((a) =>
          a.name === filename ? { ...a, updatedAt: Date.now() } : a,
        );
        artifactSlice.setArtifacts(updated);

        return { content: `Updated file ${filename}` };
      }

      case "get": {
        const existing = artifactSlice.artifacts.find((a) => a.name === filename);
        if (!existing) {
          return { content: `Error: File ${filename} not found`, isError: true };
        }

        let content: string;
        if (existing.type === "json") {
          const data = await artifactStorage.get(filename);
          content = data ? JSON.stringify(data, null, 2) : "";
        } else {
          const file = await artifactStorage.getFile(filename);
          if (!file || !file.contentBase64) {
            return { content: `Error: Could not read file ${filename}`, isError: true };
          }
          content = decodeURIComponent(escape(atob(file.contentBase64)));
        }

        return { content };
      }

      case "delete": {
        const existing = artifactSlice.artifacts.find((a) => a.name === filename);
        if (!existing) {
          return { content: `Error: File ${filename} not found`, isError: true };
        }

        if (existing.source === "json") {
          await artifactStorage.delete(filename);
        } else {
          await artifactStorage.deleteFile(filename);
        }

        const remaining = artifactSlice.artifacts.filter((a) => a.name !== filename);
        artifactSlice.setArtifacts(remaining);

        if (artifactSlice.selectedArtifact === filename) {
          artifactSlice.selectArtifact(remaining[0]?.name || null);
        }

        return { content: `Deleted file ${filename}` };
      }

      case "logs": {
        // For HTML files, logs are collected by the HtmlSandbox component
        // Return a placeholder - actual logs would need to be tracked
        return {
          content:
            "Logs feature requires HTML file execution. Use the artifacts panel to view console output.",
        };
      }

      default:
        return { content: `Error: Unknown command ${command}`, isError: true };
    }
  } catch (e) {
    return {
      content: `Error: ${e instanceof Error ? e.message : String(e)}`,
      isError: true,
    };
  }
}

function getMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const mimeTypes: Record<string, string> = {
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    json: "application/json",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    md: "text/markdown",
    txt: "text/plain",
    csv: "text/csv",
  };
  return mimeTypes[ext] || "application/octet-stream";
}
