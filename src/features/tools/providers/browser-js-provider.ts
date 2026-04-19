import type { RuntimeProvider, SandboxRequest, ProviderContext } from "@/ports/runtime-provider";
import type { Result, ToolError } from "@/shared/errors";
import { ok, err } from "@/shared/errors";
import type { SkillMatch } from "@/shared/skill-types";

/**
 * skillMatches から target page の window に extractor を載せるための JS を組み立てる。
 * 例: `window["youtube"]["getVideoInfo"] = (function () { ... });`
 * hyphen などを含む id でも壊れないよう bracket notation と JSON.stringify を使う。
 */
export function buildSkillInjection(skillMatches?: readonly SkillMatch[]): string {
  if (!skillMatches || skillMatches.length === 0) return "";
  const lines: string[] = [];
  for (const match of skillMatches) {
    const sid = JSON.stringify(match.skill.id);
    lines.push(`window[${sid}] = window[${sid}] || {};`);
    for (const ext of match.availableExtractors) {
      const eid = JSON.stringify(ext.id);
      lines.push(`window[${sid}][${eid}] = (${ext.code});`);
    }
  }
  return lines.join("\n");
}

/**
 * BrowserJsProvider - browserjs() 機能の提供
 *
 * アクティブタブでJavaScriptを実行し、結果を返す。
 */
export class BrowserJsProvider implements RuntimeProvider {
  readonly actions = ["browserjs"] as const;

  getDescription(): string {
    return `## browserjs(fn, ...args) - For Data Extraction ONLY

Execute JavaScript in the active tab's page context to read/scrape data.

### When to Use
- Extracting text content from elements
- Getting page metadata (title, URL)
- Checking element existence or visibility
- Reading computed styles
- Polling for dynamic content

### Do NOT Use For
- Clicking elements (use nativeClick)
- Typing text (use nativeType)
- Form submissions (use native functions)
- Navigation (use navigate)

### Critical - Function Serialization
The function is **serialized** and executed in the page context. This means:

**What works:**
- MUST pass data as parameters (JSON-serializable only)
- CAN use artifact functions (auto-injected)
- CAN use native input functions (auto-injected)

**What doesn't work:**
- CANNOT access variables from REPL scope (closures don't work)
- CANNOT navigate - no window.location inside browserjs()

### Examples
\`\`\`javascript
// Get page title
const title = await browserjs(() => document.title);

// Extract data with parameters (CORRECT)
const selector = '.product';
const products = await browserjs((sel) => {
  return Array.from(document.querySelectorAll(sel)).map(el => ({
    name: el.querySelector('h2')?.textContent,
    price: el.querySelector('.price')?.textContent
  }));
}, selector);  // Pass as parameter

// Closure trap (WRONG)
const selector = '.product';
await browserjs(() => {
  // selector is undefined here!
  return document.querySelectorAll(selector).length;
});
\`\`\``;
  }

  async handleRequest(
    request: SandboxRequest,
    context: ProviderContext,
  ): Promise<Result<unknown, ToolError>> {
    const { browser, signal, skillMatches } = context;
    const { code, args } = request as unknown as { code: string; args: unknown[] };

    try {
      const tab = await browser.getActiveTab();
      if (tab.id === null) {
        return err({ code: "tool_tab_not_found", message: "アクティブなタブがありません" });
      }

      const serializedArgs = (args || []).map((a) => JSON.stringify(a)).join(", ");
      const skillInjection = buildSkillInjection(skillMatches);
      const scriptCode = `(async () => {
        ${skillInjection}
        const fn = ${code};
        return await fn(${serializedArgs});
      })()`;

      const result = await browser.executeScript(tab.id, scriptCode, signal);
      if (!result.ok) {
        return err(result.error);
      }

      // browser.executeScript は `Result<ScriptResult, ToolError>` を返し、
      // ScriptResult は `{ value: unknown }` でユーザの戻り値を内部ラップする。
      // ここでさらに ok(result.value) としてしまうと、sandbox 側で
      // `await browserjs(() => ({ foo: 1 }))` の結果が `{ value: { foo: 1 } }`
      // となり、AI が `.value.foo` / `.foo` の使い分けに迷う。unwrap して
      // ユーザの直接戻り値だけを渡す。
      return ok(result.value.value);
    } catch (e: unknown) {
      return err({
        code: "tool_script_error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
}
