import { Text, UnstyledButton } from "@mantine/core";
import type { ChatMessage } from "@/ports/session-types";
import { useDeps } from "@/shared/deps-context";

function getFallbackFavicon(url: string): string {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`;
  } catch {
    return "";
  }
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function NavigationBubble({ msg }: { msg: ChatMessage }) {
  const { browserExecutor } = useDeps();
  const faviconUrl = msg.favicon || getFallbackFavicon(msg.url!);
  const displayText = msg.content || getHostname(msg.url!);

  return (
    <UnstyledButton
      onClick={() => browserExecutor.openTab(msg.url!)}
      mx="sm"
      my={4}
      px="sm"
      py={6}
      style={{
        border: "1px solid var(--mantine-color-default-border)",
        borderRadius: 8,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        maxWidth: "100%",
      }}
      className="hover-highlight"
      title={`クリックで開く: ${msg.url}`}
    >
      <img
        src={faviconUrl}
        alt=""
        width={16}
        height={16}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      <Text size="sm" fw={500} truncate>
        {displayText}
      </Text>
    </UnstyledButton>
  );
}
