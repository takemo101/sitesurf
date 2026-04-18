import type { RuntimeProvider, SandboxRequest, ProviderContext } from "@/ports/runtime-provider";
import type { BrowserError, Result, ToolError } from "@/shared/errors";
import { err, ok } from "@/shared/errors";
import type { PageContent } from "@/ports/browser-executor";

const MAX_TEXT_CHARS = 8_000;
const MAX_DOM_CHARS = 10_000;

interface ReadPageRequest extends SandboxRequest {
  maxDepth?: unknown;
}

export class ReadPageProvider implements RuntimeProvider {
  readonly actions = ["readPage"] as const;

  getDescription(): string {
    return `## readPage(maxDepth?)

Read the current page with the same lightweight extraction used by the legacy read_page tool.

- Returns: { text, simplifiedDom }
- Use this before writing custom browserjs() extraction when you need a quick page overview
- Optional maxDepth controls simplified DOM depth (default handled by BrowserExecutor)
- For precise field extraction, follow up with browserjs()`;
  }

  getRuntimeCode(): string {
    return `
async function readPage(maxDepth) {
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
    window.parent.postMessage({ type: 'sandbox-request', id, action: 'readPage', maxDepth }, '*');
  });
}`;
  }

  async handleRequest(
    request: SandboxRequest,
    context: ProviderContext,
  ): Promise<Result<unknown, ToolError>> {
    const { browser } = context;
    const { maxDepth } = request as ReadPageRequest;

    try {
      const tab = await browser.getActiveTab();
      if (tab.id === null) {
        return err({ code: "tool_tab_not_found", message: "アクティブなタブがありません" });
      }

      const result = await browser.readPageContent(
        tab.id,
        typeof maxDepth === "number" ? maxDepth : undefined,
      );
      if (!result.ok) {
        return err(toToolError(result.error));
      }

      return ok(truncatePageContent(result.value));
    } catch (e: unknown) {
      return err({
        code: "tool_script_error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
}

function toToolError(error: BrowserError): ToolError {
  return {
    code: "tool_script_error",
    message: error.message,
  };
}

function truncatePageContent(content: PageContent): PageContent {
  const truncated = { ...content };
  if (truncated.text.length > MAX_TEXT_CHARS) {
    truncated.text = truncated.text.substring(0, MAX_TEXT_CHARS) + "\n... (truncated)";
  }
  if (truncated.simplifiedDom.length > MAX_DOM_CHARS) {
    truncated.simplifiedDom =
      truncated.simplifiedDom.substring(0, MAX_DOM_CHARS) + "\n... (truncated)";
  }
  return truncated;
}
