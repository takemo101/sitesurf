import type { AIMessage } from "@/ports/ai-provider";
import type { Session, SessionMeta, ChatMessage } from "@/ports/session-types";
import { DEFAULT_TITLE, generateTitle } from "./session-store";

const PREVIEW_MAX_LENGTH = 2048;

export interface ChatState {
  messages: ChatMessage[];
  history: AIMessage[];
}

export function buildSaveData(
  snapshot: Session,
  chatState: ChatState,
): { session: Session; meta: SessionMeta } {
  const now = new Date().toISOString();

  const title = resolveTitle(snapshot.title, chatState.messages);

  const session: Session = {
    ...snapshot,
    title,
    messages: chatState.messages,
    history: chatState.history,
  };

  const preview = buildPreview(chatState.messages);

  const meta: SessionMeta = {
    id: snapshot.id,
    title,
    createdAt: snapshot.createdAt,
    lastModified: now,
    messageCount: chatState.messages.length,
    modelId: snapshot.model,
    preview,
  };

  return { session, meta };
}

function resolveTitle(currentTitle: string, messages: ChatMessage[]): string {
  if (currentTitle !== DEFAULT_TITLE) return currentTitle;
  const firstUserMessage = messages.find((m) => m.role === "user");
  if (!firstUserMessage) return currentTitle;
  return generateTitle(firstUserMessage.content);
}

function buildPreview(messages: ChatMessage[]): string {
  let preview = "";
  for (const msg of messages) {
    if (preview.length >= PREVIEW_MAX_LENGTH) break;
    if (msg.role === "user" || msg.role === "assistant") {
      preview += msg.content + "\n";
    }
  }
  return preview.substring(0, PREVIEW_MAX_LENGTH);
}
