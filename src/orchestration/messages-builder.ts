import type { AIMessage, AssistantContent, UserContent } from "@/ports/ai-provider";
import type { ChatMessage, Session } from "@/ports/session-types";
import type { SkillRegistry } from "@/shared/skill-registry";
import { convertNavigationForAPI } from "./navigation-converter";
import { stripStructuredSummaryMessage } from "./context-compressor";
import { buildSkillDetectionMessage, isSkillDetectionMessage } from "./skill-detector";

/** Session summary を API 送信用 messages 先頭に載せるときのプレフィックス */
export const SESSION_SUMMARY_PREFIX = "[過去の会話の要約]\n";

/** 先頭メッセージが session summary プロンプトと一致するか判定する */
function isLeadingSessionSummaryMessage(
  message: AIMessage | undefined,
  summaryText?: string,
): boolean {
  if (!message || !summaryText || message.role !== "user") return false;
  if (!Array.isArray(message.content) || message.content.length !== 1) return false;

  const [part] = message.content;
  return part.type === "text" && part.text === `${SESSION_SUMMARY_PREFIX}${summaryText}`;
}

/** 先頭に貼られている session summary プロンプトを 1 件だけ落とす */
export function stripLeadingSessionSummaryMessage(
  messages: AIMessage[],
  summaryText?: string,
): AIMessage[] {
  if (!isLeadingSessionSummaryMessage(messages[0], summaryText)) {
    return messages;
  }
  return messages.slice(1);
}

/**
 * 構造化要約メッセージ（`[構造化要約]\n...`）は圧縮直後の in-memory messages
 * 先頭に残るが、セッション永続化の履歴には session.summary として別途保持する
 * ため、重複送信・残骸蓄積を避けるために先頭から外しておく。
 */
export function stripLeadingStructuredSummary(messages: AIMessage[]): AIMessage[] {
  if (stripStructuredSummaryMessage(messages[0]) === undefined) {
    return messages;
  }
  return messages.slice(1);
}

/*
 * Phase 2 で get_tool_result ツールを廃止する前に作られたセッションの履歴には
 * `Stored: tool_result://...` / `Use get_tool_result("...") for full content.`
 * のマーカー行が残り続けており、それを読み取った AI が存在しないツールを
 * 呼び出して invalid-tool エラーを起こす。履歴読み込み / 書き戻しのいずれの
 * 経路でもマーカーを除去して、ユーザが気づかないうちにセッションを健全化する。
 */
const LEGACY_STORED_MARKER_RE = /\nStored: tool_result:\/\/[^\n]+\n?/g;
const LEGACY_USE_MARKER_RE = /\nUse get_tool_result\("[^"]+"\) for full content\.\n?/g;

export function stripLegacyToolResultMarkers(messages: AIMessage[]): AIMessage[] {
  let mutated = false;
  const next = messages.map((message) => {
    if (message.role !== "tool" || typeof message.result !== "string") return message;
    const cleaned = message.result
      .replace(LEGACY_STORED_MARKER_RE, "\n")
      .replace(LEGACY_USE_MARKER_RE, "\n");
    if (cleaned === message.result) return message;
    mutated = true;
    return { ...message, result: cleaned };
  });
  return mutated ? next : messages;
}

/**
 * 画像文字列を Vercel AI SDK が受け付ける `{ mimeType, base64 }` に正規化する。
 *
 * - `data:image/...;base64,XXXX` 形式のデータ URL ならそのまま分解
 * - それ以外は PNG 扱いの生 base64 として扱う
 */
export function normalizeImageForApi(image: string): { mimeType: string; base64: string } {
  const value = image.trim();
  if (value.startsWith("data:image/")) {
    const comma = value.indexOf(",");
    if (comma > 0) {
      const header = value.slice(0, comma).toLowerCase();
      const base64 = value.slice(comma + 1).trim();
      const mimeMatch = /^data:(image\/[a-z0-9.+-]+)/.exec(header);
      const isBase64 = header.includes(";base64");
      if (mimeMatch && isBase64 && base64.length > 0) {
        return {
          mimeType: mimeMatch[1],
          base64,
        };
      }
    }
  }

  return {
    mimeType: "image/png",
    base64: value,
  };
}

/** ChatMessage (user / navigation) を AIMessage に変換する */
function chatMessageToAIMessage(msg: ChatMessage): AIMessage | null {
  switch (msg.role) {
    case "user": {
      const content: UserContent[] = [{ type: "text", text: msg.content }];
      if (msg.image) {
        const image = normalizeImageForApi(msg.image);
        content.push({ type: "image", mimeType: image.mimeType, data: image.base64 });
      }
      return { role: "user", content };
    }
    case "navigation":
      return convertNavigationForAPI(msg);
    default:
      return null;
  }
}

/**
 * API 呼び出し用の messages 配列を組み立てる。
 *
 * 1. session summary（存在すれば先頭の user メッセージとして貼る）
 * 2. 永続化履歴（skill detection メッセージと session summary は除外）
 * 3. 現在 URL に対する skill detection メッセージ（該当スキルがあれば）
 * 4. 現在のチャット上にしかない新しい user / navigation メッセージ
 */
export function buildMessagesForAPI(
  session: Session,
  chatMessages: ChatMessage[],
  currentUrl: string,
  skillRegistry: SkillRegistry,
  options: { historyUserCount?: number } = {},
): AIMessage[] {
  const messages: AIMessage[] = [];
  const persistedHistory = stripLegacyToolResultMarkers(
    stripLeadingSessionSummaryMessage(
      session.history.filter((message) => !isSkillDetectionMessage(message)),
      session.summary?.text,
    ),
  );

  // 1. Session summary (if exists)
  if (session.summary) {
    messages.push({
      role: "user",
      content: [{ type: "text", text: `${SESSION_SUMMARY_PREFIX}${session.summary.text}` }],
    });
  }

  // 2. Add session history
  messages.push(...persistedHistory);

  // 3. Add skill detection message (before user messages)
  if (currentUrl) {
    const skillMatches = skillRegistry.getAvailableSkills(currentUrl);
    const skillMessage = buildSkillDetectionMessage(skillMatches);
    if (skillMessage) {
      messages.push(skillMessage);
    }
  }

  // 4. Add new user messages (including navigation messages)
  const historyUserCount =
    options.historyUserCount ?? persistedHistory.filter((m) => m.role === "user").length;
  const userMessages = chatMessages.filter((m) => m.role === "user" || m.role === "navigation");
  const newMessages = userMessages.slice(historyUserCount);

  for (const msg of newMessages) {
    const converted = chatMessageToAIMessage(msg);
    if (converted) messages.push(converted);
  }

  return messages;
}

/**
 * ターン終了時の assistant メッセージ（assistantText + tool-call 群）を
 * `AssistantContent[]` に組み立てる。tool-call に providerOptions があればそのまま引き継ぐ。
 */
export function buildAssistantMessageContent(
  assistantText: string,
  pendingToolCalls: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
    providerOptions?: Record<string, Record<string, unknown>>;
  }>,
): AssistantContent[] {
  const content: AssistantContent[] = [];
  if (assistantText) {
    content.push({ type: "text", text: assistantText });
  }
  for (const tc of pendingToolCalls) {
    content.push({
      type: "tool-call",
      id: tc.id,
      name: tc.name,
      args: tc.args,
      ...(tc.providerOptions ? { providerOptions: tc.providerOptions } : {}),
    });
  }
  return content;
}

/**
 * 履歴永続化用に messages を整形する。
 *
 * - skill detection メッセージを除去する
 * - 先頭の構造化要約 / session summary プレフィックス付きメッセージを除去する
 * - legacy な tool_result:// マーカーを除去する
 */
export function toPersistedHistory(messages: AIMessage[], summaryText?: string): AIMessage[] {
  const withoutSkillMessages = messages.filter((message) => !isSkillDetectionMessage(message));
  const withoutStructuredSummary = stripLeadingStructuredSummary(withoutSkillMessages);
  const withoutSessionSummary = stripLeadingSessionSummaryMessage(
    withoutStructuredSummary,
    summaryText,
  );
  return stripLegacyToolResultMarkers(withoutSessionSummary);
}
