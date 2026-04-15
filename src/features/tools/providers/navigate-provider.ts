import type { RuntimeProvider, SandboxRequest, ProviderContext } from "@/ports/runtime-provider";
import type { Result, ToolError } from "@/shared/errors";
import { ok, err } from "@/shared/errors";

/**
 * NavigateProvider - navigate() 機能の提供
 *
 * ページナビゲーションを実行し、結果を返す。
 */
export class NavigateProvider implements RuntimeProvider {
  readonly actions = ["navigate"] as const;

  getDescription(): string {
    return `## navigate(url)

Navigate to a URL and wait for page load.

### When to Use
- Multi-page scraping workflows
- Navigating to different URLs

### Do NOT Use For
- Single page interactions (use native functions)
- Inside browserjs() (closures don't work)

\`\`\`javascript
// ✅ CORRECT: Navigate and extract
const result = await navigate('https://example.com');
const title = await browserjs(() => document.title);

// ✅ CORRECT: Multi-page scraping
const results = [];
for (const url of urls) {
  await navigate(url);
  const data = await browserjs(() => ({
    title: document.title,
    text: document.body.innerText.substring(0, 1000)
  }));
  results.push(data);
}
\`\`\``;
  }

  getRuntimeCode(): string {
    return `
function navigate(url) {
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
    window.parent.postMessage({ type: 'sandbox-request', id, action: 'navigate', url }, '*');
  });
}`;
  }

  async handleRequest(
    request: SandboxRequest,
    context: ProviderContext,
  ): Promise<Result<unknown, ToolError>> {
    const { browser } = context;
    const { url } = request as unknown as { url: string };

    try {
      const tab = await browser.getActiveTab();
      if (tab.id === null) {
        return err({ code: "tool_tab_not_found", message: "アクティブなタブがありません" });
      }

      const result = await browser.navigateTo(tab.id, url);
      if (!result.ok) {
        // BrowserError -> ToolError に変換
        const toolError: ToolError = {
          code: "tool_script_error",
          message: result.error.message,
        };
        return err(toolError);
      }

      return ok(result.value);
    } catch (e: unknown) {
      return err({
        code: "tool_script_error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
}
