import type { ToolDefinition } from "@/ports/ai-provider";
import type { BrowserExecutor, ElementInfo } from "@/ports/browser-executor";
import type { BrowserError, Result, ToolError } from "@/shared/errors";
import { err } from "@/shared/errors";

export const pickElementToolDef: ToolDefinition = {
  name: "pick_element",
  description:
    "ユーザーにページ上の要素をクリックして選択してもらう。ユーザーが「この要素」「このボタン」と言ったがセレクタが不明な時に使う。選択された要素のCSSセレクタ、タグ名、テキスト、属性を返す。",
  parameters: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description:
          "ユーザーに表示する指示メッセージ (例: '操作したい要素をクリックしてください')",
      },
    },
    required: [],
  },
};

export async function executePickElement(
  browser: BrowserExecutor,
  args: { message?: string },
): Promise<Result<ElementInfo | null, ToolError | BrowserError>> {
  const tab = await browser.getActiveTab();
  if (tab.id === null) {
    return err({ code: "tool_tab_not_found", message: "アクティブなタブがありません" });
  }
  return browser.injectElementPicker(tab.id, args.message);
}
