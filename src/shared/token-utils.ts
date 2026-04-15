import type { AIMessage } from "@/ports/ai-provider";

export function estimateTokens(messages: AIMessage[]): number {
  let chars = 0;
  for (const msg of messages) {
    if ("content" in msg && Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if ("text" in part && part.text) {
          chars += part.text.length;
        }
      }
    }
  }
  return chars;
}
