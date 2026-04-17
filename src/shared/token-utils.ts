import type { AIMessage } from "@/ports/ai-provider";

export function estimateTokens(messages: AIMessage[]): number {
  let chars = 0;
  for (const msg of messages) {
    if (msg.role === "tool") {
      chars += msg.result.length;
    } else if ("content" in msg && Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === "text") {
          chars += part.text.length;
        } else if (part.type === "image") {
          chars += 6000; // ~1500 tokens
        } else if (part.type === "tool-call") {
          chars += JSON.stringify(part.args).length;
        }
      }
    }
  }
  return chars;
}
