import type { RuntimeProvider, SandboxRequest, ProviderContext } from "@/ports/runtime-provider";
import type { Result, ToolError } from "@/shared/errors";
import { ok, err } from "@/shared/errors";

/**
 * ArtifactProvider - Artifact Functions の提供
 *
 * JSONデータの永続化ストレージを提供する。
 */
export class ArtifactProvider implements RuntimeProvider {
  readonly actions = [
    "createOrUpdateArtifact",
    "getArtifact",
    "listArtifacts",
    "deleteArtifact",
    "returnFile",
  ] as const;

  getDescription(): string {
    return `## Artifact Functions (Data Persistence)

Store and retrieve JSON data across REPL executions:

- \`await createOrUpdateArtifact(name, data)\` - Save JSON data
- \`await getArtifact(name)\` - Retrieve saved data
- \`await listArtifacts()\` - List all artifact names
- \`await deleteArtifact(name)\` - Delete an artifact

\`\`\`javascript
// Save scraping results
await createOrUpdateArtifact("products", [{ name: "A" }, { name: "B" }]);

// Retrieve in another script
const products = await getArtifact("products");
\`\`\`

## File Functions

Return files to the AI:

- \`await returnFile(name, content, mimeType)\`
  - name: filename (e.g., "data.csv")
  - content: string or Uint8Array
  - mimeType: e.g., "text/csv", "application/pdf"

\`\`\`javascript
const csv = "name,price\\nA,100\\nB,200";
await returnFile("products.csv", csv, "text/csv");
\`\`\``;
  }

  getRuntimeCode(): string {
    return `
function createOrUpdateArtifact(name, data) {
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
    window.parent.postMessage({ type: 'sandbox-request', id, action: 'createOrUpdateArtifact', name, data }, '*');
  });
}

function getArtifact(name) {
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
    window.parent.postMessage({ type: 'sandbox-request', id, action: 'getArtifact', name }, '*');
  });
}

function listArtifacts() {
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
    window.parent.postMessage({ type: 'sandbox-request', id, action: 'listArtifacts' }, '*');
  });
}

function deleteArtifact(name) {
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
    window.parent.postMessage({ type: 'sandbox-request', id, action: 'deleteArtifact', name }, '*');
  });
}

function returnFile(name, content, mimeType) {
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
    const bytes = toUtf8Bytes(content);
    const size = bytes.byteLength;
    const contentBase64 = arrayBufferToBase64(bytes);
    window.parent.postMessage({ type: 'sandbox-request', id, action: 'returnFile', name, contentBase64, mimeType, size }, '*');
  });
}

function toUtf8Bytes(content) {
  if (typeof content === 'string') {
    return new TextEncoder().encode(content);
  }

  if (content instanceof Uint8Array) {
    return content;
  }

  if (ArrayBuffer.isView(content)) {
    return new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
  }

  return new Uint8Array(content);
}

function arrayBufferToBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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
        case "createOrUpdateArtifact": {
          const { name, data } = request as unknown as { name: string; data: unknown };
          await artifactStorage.put(name, { kind: "json", data });
          return ok({ success: true, name });
        }

        case "getArtifact": {
          const { name } = request as unknown as { name: string };
          const artifact = await artifactStorage.get(name);
          if (artifact === null || artifact.kind !== "json") {
            return err({
              code: "tool_script_error",
              message: `Artifact '${name}' not found`,
            });
          }
          return ok(artifact.data);
        }

        case "listArtifacts": {
          const list = (await artifactStorage.list())
            .filter((artifact) => artifact.kind === "json")
            .map((artifact) => artifact.name);
          return ok(list);
        }

        case "deleteArtifact": {
          const { name } = request as unknown as { name: string };
          await artifactStorage.delete(name);
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

function base64ToBytes(base64: string): Uint8Array {
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}
