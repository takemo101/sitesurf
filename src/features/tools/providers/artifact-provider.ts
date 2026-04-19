import type { ArtifactValue } from "@/ports/artifact-storage";
import type { RuntimeProvider, SandboxRequest, ProviderContext } from "@/ports/runtime-provider";
import { getMimeType } from "@/shared/artifact-mime";
import type { Result, ToolError } from "@/shared/errors";
import { ok, err } from "@/shared/errors";

/**
 * ArtifactProvider - Artifact Functions の提供 (ADR-007)
 *
 * AI は `saveArtifact / getArtifact / listArtifacts / deleteArtifact` の 4 helper で
 * JSON 値・ファイルを同一ネームスペースで扱う。旧 `createOrUpdateArtifact` /
 * `returnFile` は v0.1.6 で deprecation wrapper として残していたが、v0.1.7 (#137) で完全削除。
 */
export class ArtifactProvider implements RuntimeProvider {
  readonly actions = ["saveArtifact", "getArtifact", "listArtifacts", "deleteArtifact"] as const;

  getDescription(): string {
    return `## Artifact Functions (Data Persistence)

Artifacts persist across REPL executions in a single unified store. Save JSON
values, text, or binary bytes with the same API.

- \`await saveArtifact(name, data, options?)\` — save anything
  - \`data\`: object/array/number → JSON; \`Uint8Array\` → binary file;
    \`string\` + \`options.mimeType\` or \`name\` has extension → file (UTF-8); otherwise → JSON string
  - \`options.mimeType\`: override inferred MIME (e.g. "text/plain")
  - \`options.visible\`: \`false\` keeps it out of the UI Artifact Panel (scratch data)
- \`await getArtifact(name)\` — returns \`{ kind: "json", data }\` or \`{ kind: "file", bytes, mimeType }\`
- \`await listArtifacts()\` — returns \`[{ name, kind, mimeType?, size, visible, createdAt, updatedAt }, ...]\`
- \`await deleteArtifact(name)\` — delete (any kind)

\`\`\`javascript
// JSON
await saveArtifact("products", [{ name: "A" }]);
const result = await getArtifact("products");
// result => { kind: "json", data: [{ name: "A" }] }

// HTML (string + extension → file)
await saveArtifact("report.html", "<!doctype html><h1>ok</h1>");

// Binary
await saveArtifact("icon.png", new Uint8Array([...]), { mimeType: "image/png" });

// Scratch data (hidden from UI)
await saveArtifact("_debug", logEntries, { visible: false });

// Inspect what you have
const items = await listArtifacts();
// items => [{ name: "products", kind: "json", size: 24, visible: true, ... }, ...]
\`\`\``;
  }

  async handleRequest(
    request: SandboxRequest,
    context: ProviderContext,
  ): Promise<Result<unknown, ToolError>> {
    const { artifactStorage } = context;
    const { action } = request;

    try {
      switch (action) {
        case "saveArtifact": {
          const { name, data, mimeType, visible } = request as unknown as {
            name: string;
            data: unknown;
            mimeType?: string;
            visible?: boolean;
          };
          const value = inferArtifactValue(name, data, mimeType);
          await artifactStorage.put(name, value, visible === undefined ? undefined : { visible });
          return ok({ success: true, name, kind: value.kind });
        }

        case "getArtifact": {
          const { name } = request as unknown as { name: string };
          const artifact = await artifactStorage.get(name);
          if (artifact === null) {
            return err({
              code: "tool_script_error",
              message: `Artifact '${name}' not found`,
            });
          }
          return ok(artifact);
        }

        case "listArtifacts": {
          return ok(await artifactStorage.list());
        }

        case "deleteArtifact": {
          const { name } = request as unknown as { name: string };
          await artifactStorage.delete(name);
          return ok({ success: true, name });
        }

        default:
          return err({
            code: "tool_script_error",
            message: `Unknown artifact action: ${action}`,
          });
      }
    } catch (e: unknown) {
      return err({
        code: "tool_script_error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
}

/**
 * saveArtifact の自動型判別:
 * - Uint8Array → file (mimeType 指定なければ拡張子から推測)
 * - string かつ mimeType 指定あり → file
 * - string かつ name に拡張子あり → file (mimeType は拡張子から)
 * - それ以外 (object / array / primitive / 拡張子なしの string) → json
 */
export function inferArtifactValue(
  name: string,
  data: unknown,
  mimeType: string | undefined,
): ArtifactValue {
  if (data instanceof Uint8Array) {
    return {
      kind: "file",
      bytes: data,
      mimeType: mimeType ?? getMimeType(name),
    };
  }

  if (typeof data === "string" && (mimeType || hasFileExtension(name))) {
    return {
      kind: "file",
      bytes: new TextEncoder().encode(data),
      mimeType: mimeType ?? getMimeType(name),
    };
  }

  return { kind: "json", data };
}

function hasFileExtension(name: string): boolean {
  return /\.[^./\\]+$/.test(name);
}
