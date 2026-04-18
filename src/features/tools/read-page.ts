import type { ToolDefinition } from "@/ports/ai-provider";
import type { BrowserExecutor, PageContent } from "@/ports/browser-executor";
import type { BrowserError, Result, ToolError } from "@/shared/errors";
import { err } from "@/shared/errors";

export const readPageToolDef: ToolDefinition = {
  name: "read_page",
  description:
    "現在のアクティブタブ **1ページのみ** の主要コンテンツを軽量抽出する。タイトル、本文（プレーンテキスト）、メタ情報を返す。\n\n**2ページ以上を順に収集する用途ではこのツールを使わないこと。** 複数ページを跨ぐ場合は `repl` で loop 制御する。\n\nより詳細な抽出が必要な場合は `repl` の `browserjs()` を使用する。",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
};

const MAX_TEXT_CHARS = 8_000;
const MAX_DOM_CHARS = 10_000;

export async function executeReadPage(
  browser: BrowserExecutor,
  _args: Record<string, unknown>,
): Promise<Result<PageContent, ToolError | BrowserError>> {
  const tab = await browser.getActiveTab();
  if (tab.id === null) {
    return err({ code: "tool_tab_not_found", message: "アクティブなタブがありません" });
  }
  const result = await browser.readPageContent(tab.id);
  if (!result.ok) return result;

  const truncated = { ...result.value };
  if (truncated.text.length > MAX_TEXT_CHARS) {
    truncated.text = truncated.text.substring(0, MAX_TEXT_CHARS) + "\n... (truncated)";
  }
  if (truncated.simplifiedDom.length > MAX_DOM_CHARS) {
    truncated.simplifiedDom =
      truncated.simplifiedDom.substring(0, MAX_DOM_CHARS) + "\n... (truncated)";
  }
  return { ok: true, value: truncated };
}
