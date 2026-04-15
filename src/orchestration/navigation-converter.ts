import type { AIMessage } from "@/ports/ai-provider";
import type { ChatMessage } from "@/ports/session-types";

export function convertNavigationForAPI(nav: ChatMessage): AIMessage {
  return {
    role: "user",
    content: [{ type: "text", text: `[ページ遷移] ${nav.content}\nURL: ${nav.url}` }],
  };
}
