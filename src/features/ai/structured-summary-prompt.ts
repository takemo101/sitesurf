import type { AIMessage } from "@/ports/ai-provider";

const TOOL_RESULT_MAX_CHARS = 2_000;

export const STRUCTURED_SUMMARY_SYSTEM_PROMPT = [
  "あなたは長い会話履歴を圧縮する要約エージェントです。",
  "出力は必ず日本語の Markdown で返してください。",
  "次の見出しだけを必要な場合に使ってください: ## Goal / ## Constraints & Preferences / ## Progress / ## Key Decisions / ## Next Steps / ## Critical Context / ## Visited URLs",
  "該当情報がない見出しや空のセクションは出力しないでください。",
  "Progress を出す場合だけ ### Done / ### In Progress / ### Blocked を使ってください。",
  "ユーザーの目標、制約、決定、未完了タスク、失うと困る重要情報を優先して残してください。",
  "ツール結果は詳細を丸写しせず、次のターンで必要な事実だけを残してください。",
].join("\n");

export function buildStructuredSummaryPromptInput(input: {
  existingSummary?: string;
  messages: AIMessage[];
}): string {
  const parts: string[] = [];

  if (input.existingSummary) {
    parts.push(`[既存の構造化要約]\n${input.existingSummary.trim()}\n`);
  }

  parts.push("[新規の会話履歴]");
  for (const message of input.messages) {
    const rendered = renderMessageForSummary(message);
    if (rendered) {
      parts.push(rendered);
    }
  }

  return parts.join("\n");
}

function renderMessageForSummary(message: AIMessage): string {
  if (message.role === "tool") {
    return `ツール (${message.toolName}): ${truncateForSummary(message.result)}`;
  }

  const role = message.role === "user" ? "ユーザー" : "アシスタント";
  const segments = message.content.flatMap((part) => {
    if (part.type === "text") return part.text;
    if (part.type === "image") return "[image]";
    return `ツール呼び出し ${part.name}(${JSON.stringify(part.args)})`;
  });

  const text = segments.join(" ").trim();
  return text ? `${role}: ${text}` : "";
}

function truncateForSummary(text: string): string {
  if (text.length <= TOOL_RESULT_MAX_CHARS) return text;
  return `${text.slice(0, TOOL_RESULT_MAX_CHARS)}...(truncated for summary)`;
}
