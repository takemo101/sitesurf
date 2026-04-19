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
 * `returnFile` は deprecation wrapper として残し、内部で `saveArtifact` へ forward する。
 */
export class ArtifactProvider implements RuntimeProvider {
  readonly actions = [
    "saveArtifact",
    "getArtifact",
    "listArtifacts",
    "deleteArtifact",
    // Legacy action names still accepted; wrapper helpers ride on them as a safety net
    // even though the emitted runtime now sends only the new names.
    "createOrUpdateArtifact",
    "returnFile",
  ] as const;

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
\`\`\`

### Deprecated (will be removed in a future release)

- \`createOrUpdateArtifact(name, data)\` → use \`saveArtifact(name, data)\`
- \`returnFile(name, content, mimeType)\` → use \`saveArtifact(name, content, { mimeType })\``;
  }

  getRuntimeCode(): string {
    return `
function __artifactRequest(action, payload) {
  return new Promise((resolve, reject) => {
    const id = 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const handler = (event) => {
      if (event.data?.type === 'sandbox-response' && event.data.id === id) {
        window.removeEventListener('message', handler);
        if (event.data.ok) {
          resolve(event.data.value);
        } else {
          reject(new Error(event.data.error));
        }
      }
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({ type: 'sandbox-request', id, action, ...payload }, '*');
  });
}

function saveArtifact(name, data, options) {
  const opts = options || {};
  return __artifactRequest('saveArtifact', {
    name,
    data,
    mimeType: opts.mimeType,
    visible: opts.visible,
  });
}

function getArtifact(name) {
  return __artifactRequest('getArtifact', { name });
}

function listArtifacts() {
  return __artifactRequest('listArtifacts', {});
}

function deleteArtifact(name) {
  return __artifactRequest('deleteArtifact', { name });
}

// --- Deprecated helpers (forward to saveArtifact) ---
function createOrUpdateArtifact(name, data) {
  console.warn('createOrUpdateArtifact() is deprecated; use saveArtifact(name, data).');
  return saveArtifact(name, data);
}

function returnFile(name, content, mimeType) {
  console.warn('returnFile() is deprecated; use saveArtifact(name, content, { mimeType }).');
  return saveArtifact(name, content, { mimeType });
}`;
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

        // --- Legacy wire protocol (no longer emitted by getRuntimeCode, kept for safety) ---
        case "createOrUpdateArtifact": {
          const { name, data } = request as unknown as { name: string; data: unknown };
          await artifactStorage.put(name, { kind: "json", data });
          return ok({ success: true, name });
        }

        case "returnFile": {
          const { name, contentBase64, mimeType } = request as unknown as {
            name: string;
            contentBase64: string;
            mimeType: string;
          };
          await artifactStorage.put(name, {
            kind: "file",
            bytes: base64ToBytes(contentBase64),
            mimeType,
          });
          return ok({
            success: true,
            fileName: name,
            mimeType,
          });
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

function base64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}
