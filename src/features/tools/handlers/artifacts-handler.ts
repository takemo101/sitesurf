import type { ArtifactStoragePort, ArtifactValue } from "@/ports/artifact-storage";
import { getMimeType } from "@/shared/artifact-mime";
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

        const existing = artifactSlice.artifacts.find((a) => a.name === filename);
        if (existing) {
          return {
            content: `Error: File ${filename} already exists. Use 'rewrite' to replace it.`,
            isError: true,
          };
        }

        const value = stringContentToArtifactValue(filename, args.content);
        if (!value.ok) {
          return { content: value.error, isError: true };
        }

        await artifactStorage.put(filename, value.value);

        const type = detectType(filename);
        const entry: ArtifactEntry = {
          name: filename,
          type,
          source: value.value.kind,
          updatedAt: Date.now(),
        };
        artifactSlice.setArtifacts([...artifactSlice.artifacts, entry]);
        artifactSlice.selectArtifact(filename);

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

        const value = stringContentToArtifactValue(filename, args.content);
        if (!value.ok) {
          return { content: value.error, isError: true };
        }

        await artifactStorage.put(filename, value.value);

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

        const stored = await artifactStorage.get(filename);
        if (!stored) {
          return { content: `Error: Could not read file ${filename}`, isError: true };
        }

        const currentContent = artifactValueToString(stored);

        if (!args.old_str || !currentContent.includes(args.old_str)) {
          return {
            content: `Error: String not found in file. Here is the full content:\n\n${currentContent}`,
            isError: true,
          };
        }

        const newContent = currentContent.replace(args.old_str, args.new_str);
        const value = stringContentToArtifactValue(filename, newContent);
        if (!value.ok) {
          return { content: value.error, isError: true };
        }

        await artifactStorage.put(filename, value.value);

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

        const stored = await artifactStorage.get(filename);
        if (!stored) {
          return { content: `Error: Could not read file ${filename}`, isError: true };
        }

        return { content: artifactValueToString(stored) };
      }

      case "delete": {
        const existing = artifactSlice.artifacts.find((a) => a.name === filename);
        if (!existing) {
          return { content: `Error: File ${filename} not found`, isError: true };
        }

        await artifactStorage.delete(filename);

        const remaining = artifactSlice.artifacts.filter((a) => a.name !== filename);
        artifactSlice.setArtifacts(remaining);

        if (artifactSlice.selectedArtifact === filename) {
          artifactSlice.selectArtifact(remaining[0]?.name || null);
        }

        return { content: `Deleted file ${filename}` };
      }

      case "logs": {
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

// top-level `artifacts` tool は string content を受け取る。拡張子で kind を
// 決めるのは「content をどう解釈するか」の content 層の判断であり、
// ADR-007 が排除したかった "どの store に保存するか" の storage 層の判断とは別物。
// `.json` のみ JSON parse + JSON kind、他はすべて file kind として保存する。
function stringContentToArtifactValue(
  filename: string,
  content: string,
): { ok: true; value: ArtifactValue } | { ok: false; error: string } {
  const isJsonFile = detectType(filename) === "json";

  if (isJsonFile) {
    try {
      return { ok: true, value: { kind: "json", data: JSON.parse(content) } };
    } catch (e) {
      return {
        ok: false,
        error: `Error: Invalid JSON content for ${filename}: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }

  return {
    ok: true,
    value: {
      kind: "file",
      bytes: new TextEncoder().encode(content),
      mimeType: getMimeType(filename),
    },
  };
}

function artifactValueToString(value: ArtifactValue): string {
  if (value.kind === "json") {
    return JSON.stringify(value.data, null, 2);
  }
  return new TextDecoder().decode(value.bytes);
}
