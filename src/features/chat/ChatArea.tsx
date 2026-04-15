import { useCallback, useEffect, useRef, useState } from "react";
import { ActionIcon, Loader, Stack, Text } from "@mantine/core";
import { ArrowDown } from "lucide-react";
import { useStore } from "@/store/index";
import { MessageBubble } from "./MessageBubble";
import { StreamingIndicator } from "./StreamingIndicator";
import { WelcomeScreen } from "./WelcomeScreen";

const AUTO_FOLLOW_THRESHOLD = 16;
const SHOW_SCROLL_BUTTON_THRESHOLD = 120;
const HIDE_SCROLL_BUTTON_THRESHOLD = 40;

function LoadingState() {
  return (
    <Stack align="center" justify="center" flex={1}>
      <Loader size="sm" color="indigo" />
      <Text size="xs" c="dimmed">
        セッション読み込み中...
      </Text>
    </Stack>
  );
}

export function ChatArea({ onSend }: { onSend?: (text: string) => void }) {
  const messages = useStore((s) => s.messages);
  const isStreaming = useStore((s) => s.isStreaming);
  const sessionLoading = useStore((s) => s.sessionLoading);

  const viewportRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);
  const hintedRef = useRef(false);
  const prefersReducedMotionRef = useRef(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(false);

  const hasConversation = messages.some((m) => m.role === "user" || m.role === "assistant");

  const scrollToBottom = useCallback(() => {
    const viewport = viewportRef.current;
    if (viewport) {
      const shouldUseAuto = isStreaming || prefersReducedMotionRef.current;
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: shouldUseAuto ? "auto" : "smooth",
      });
    }
  }, [isStreaming]);

  const handleScrollToBottomClick = useCallback(() => {
    userScrolledUp.current = false;
    setShowScrollToBottom(false);
    scrollToBottom();
  }, [scrollToBottom]);

  useEffect(() => {
    if (!userScrolledUp.current) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersReducedMotionRef.current = media.matches;

    const onChange = (e: MediaQueryListEvent) => {
      prefersReducedMotionRef.current = e.matches;
    };

    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!showScrollToBottom || hintedRef.current) return;
    setShowScrollHint(true);
    const timer = setTimeout(() => {
      setShowScrollHint(false);
      hintedRef.current = true;
    }, 2200);
    return () => clearTimeout(timer);
  }, [showScrollToBottom]);

  const handleScroll = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const { scrollTop, scrollHeight, clientHeight } = viewport;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // Auto-follow should stop as soon as user is meaningfully away from bottom.
    userScrolledUp.current = distanceFromBottom > AUTO_FOLLOW_THRESHOLD;

    setShowScrollToBottom((prev) => {
      const nextVisible = prev
        ? distanceFromBottom > HIDE_SCROLL_BUTTON_THRESHOLD
        : distanceFromBottom > SHOW_SCROLL_BUTTON_THRESHOLD;
      return prev === nextVisible ? prev : nextVisible;
    });
  }, []);

  const handlePromptSelect = useCallback(
    (prompt: string) => {
      if (onSend) onSend(prompt);
    },
    [onSend],
  );

  if (sessionLoading) {
    return <LoadingState />;
  }

  if (!hasConversation) {
    return <WelcomeScreen onPromptSelect={handlePromptSelect} />;
  }

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
      <div
        ref={viewportRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          height: "100%",
        }}
      >
        <Stack gap="xs" p="sm">
          {messages.map((msg, i) => (
            <MessageBubble key={msg.id} msg={msg} isLast={i === messages.length - 1} />
          ))}
          {isStreaming && <StreamingIndicator />}
        </Stack>
      </div>

      <div
        className="scroll-to-bottom-fab"
        style={{
          position: "absolute",
          left: "50%",
          bottom: 12,
          transform: `translateX(-50%) translateY(${showScrollToBottom ? 0 : 6}px)`,
          opacity: showScrollToBottom ? 1 : 0,
          pointerEvents: showScrollToBottom ? "auto" : "none",
          zIndex: 20,
        }}
      >
        <div
          className="scroll-to-bottom-hint"
          style={{
            opacity: showScrollHint ? 1 : 0,
            transform: `translateX(-50%) translateY(${showScrollHint ? 0 : 4}px)`,
          }}
        >
          最新へ
        </div>
        <ActionIcon
          size="lg"
          radius="xl"
          variant="filled"
          color="indigo"
          onClick={handleScrollToBottomClick}
          disabled={!showScrollToBottom}
          tabIndex={showScrollToBottom ? 0 : -1}
          aria-hidden={!showScrollToBottom}
          aria-label="最新へ移動"
          style={{ boxShadow: "var(--mantine-shadow-sm)" }}
        >
          <ArrowDown size={16} />
        </ActionIcon>
      </div>
    </div>
  );
}
