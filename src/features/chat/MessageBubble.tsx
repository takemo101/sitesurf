import type { ChatMessage } from "@/ports/session-types";
import { ChatBubble } from "./ChatBubble";
import { ErrorMessage } from "./ErrorMessage";
import { NavigationBubble } from "./NavigationBubble";
import { SystemMessage } from "./SystemMessage";

export function MessageBubble({ msg, isLast }: { msg: ChatMessage; isLast?: boolean }) {
  switch (msg.role) {
    case "navigation":
      return <NavigationBubble msg={msg} />;
    case "system":
      return <SystemMessage msg={msg} />;
    case "error":
      return <ErrorMessage msg={msg} />;
    default:
      return <ChatBubble msg={msg} isLast={isLast} />;
  }
}
