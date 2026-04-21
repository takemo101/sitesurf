import { memo } from "react";
import type { ChatMessage } from "@/ports/session-types";
import { ChatBubble } from "./ChatBubble";
import { ErrorMessage } from "./ErrorMessage";
import { NavigationBubble } from "./NavigationBubble";
import { SystemMessage } from "./SystemMessage";

export const MessageBubble = memo(function MessageBubble({
  msg,
  isLast,
  isStreaming,
}: {
  msg: ChatMessage;
  isLast?: boolean;
  isStreaming?: boolean;
}) {
  switch (msg.role) {
    case "navigation":
      return <NavigationBubble msg={msg} />;
    case "system":
      return <SystemMessage msg={msg} />;
    case "error":
      return <ErrorMessage msg={msg} />;
    default:
      return <ChatBubble msg={msg} isLast={isLast} isStreaming={isStreaming} />;
  }
});
