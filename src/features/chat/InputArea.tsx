import { useRef, useState } from "react";
import { useComputedColorScheme } from "@mantine/core";
import {
  ActionIcon,
  Badge,
  Box,
  Group,
  Menu,
  Paper,
  Text,
  Textarea,
  TextInput,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { Camera, Check, ChevronDown, FileText, MousePointer2, Send, Square } from "lucide-react";
import { useStore } from "@/store/index";
import { useDeps } from "@/shared/deps-context";
import { PROVIDERS } from "@/shared/constants";
import type { ElementInfo } from "@/ports/browser-executor";
import { ElementCard } from "./ElementCard";
import { TokenUsageDisplay } from "./TokenUsageDisplay";

export function buildElementContext(element: ElementInfo, userText: string): string {
  const parts = [
    "[選択された要素]",
    `セレクタ: ${element.selector}`,
    `タグ: <${element.tagName}>`,
    `テキスト: ${element.text?.substring(0, 100) || "(なし)"}`,
  ];

  if (element.surroundingHTML) {
    parts.push("", `周辺DOM:\n${element.surroundingHTML}`);
  }

  if (userText) {
    parts.push("", userText);
  }

  return parts.join("\n");
}

export function InputArea({
  onSend,
  onStop,
}: {
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const [text, setText] = useState("");
  const [pendingElement, setPendingElement] = useState<ElementInfo | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isStreaming = useStore((s) => s.isStreaming);
  const pendingScreenshot = useStore((s) => s.pendingScreenshot);
  const deps = useDeps();
  const colorScheme = useComputedColorScheme();

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed && !pendingElement) return;

    const messageText = pendingElement ? buildElementContext(pendingElement, trimmed) : trimmed;

    onSend(messageText);
    setText("");
    setPendingElement(null);
  };

  const handleReadPage = async () => {
    const tab = await deps.browserExecutor.getActiveTab();
    if (!tab.id) return;

    useStore.getState().addSystemMessage("📄 ページを読み取り中...");
    const result = await deps.browserExecutor.readPageContent(tab.id);

    if (!result.ok) {
      notifications.show({ title: "エラー", message: result.error.message, color: "red" });
      return;
    }

    const pageContext = [
      "[ページ内容]",
      `URL: ${tab.url}`,
      `タイトル: ${tab.title}`,
      "",
      result.value.text.substring(0, 3000),
    ].join("\n");

    onSend(pageContext);
  };

  const handlePickElement = async () => {
    const tab = await deps.browserExecutor.getActiveTab();
    if (!tab.id) return;

    useStore.getState().addSystemMessage("🎯 ページ上の要素をクリックして選択してください...");
    const result = await deps.browserExecutor.injectElementPicker(tab.id);

    if (!result.ok) {
      notifications.show({ title: "エラー", message: result.error.message, color: "red" });
      return;
    }

    if (!result.value) {
      useStore.getState().addSystemMessage("要素選択がキャンセルされました");
      return;
    }

    setPendingElement(result.value);
    setText("");
    textareaRef.current?.focus();
  };

  const handleScreenshot = async () => {
    try {
      const dataUrl = await deps.browserExecutor.captureScreenshot();
      useStore.getState().setPendingScreenshot(dataUrl);
      useStore.getState().addSystemMessage("📸 スクリーンショットを添付しました");
    } catch {
      notifications.show({
        title: "エラー",
        message: "スクリーンショットの取得に失敗しました",
        color: "red",
      });
    }
  };

  return (
    <Box px="xs" pb="xs" style={{ flexShrink: 0, zIndex: 10 }}>
      {pendingElement && (
        <ElementCard element={pendingElement} onDismiss={() => setPendingElement(null)} />
      )}

      <Paper
        withBorder
        radius="md"
        bg={
          isStreaming
            ? colorScheme === "dark"
              ? "var(--mantine-color-dark-6)"
              : "var(--mantine-color-gray-0)"
            : colorScheme === "dark"
              ? "var(--mantine-color-default)"
              : "var(--mantine-color-body)"
        }
      >
        <Textarea
          ref={textareaRef}
          placeholder={
            pendingElement
              ? "この要素に対する指示を入力..."
              : "AIに指示を入力... (Shift+Enterで改行)"
          }
          minRows={2}
          maxRows={6}
          autosize
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          disabled={isStreaming}
          variant="unstyled"
          px="sm"
          pt="xs"
          styles={{
            input: {
              fontSize: "var(--mantine-font-size-sm)",
              backgroundColor: "transparent",
              cursor: isStreaming ? "not-allowed" : "text",
            },
          }}
        />

        <Group
          justify="space-between"
          px="xs"
          py={6}
          style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}
        >
          <Group gap={4}>
            <Tooltip label="ページ読取">
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={handleReadPage}
                disabled={isStreaming}
                aria-label="ページ読取"
              >
                <FileText size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="要素選択">
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={handlePickElement}
                disabled={isStreaming}
                aria-label="要素選択"
              >
                <MousePointer2 size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="スクリーンショット">
              <ActionIcon
                variant="subtle"
                size="sm"
                onClick={handleScreenshot}
                aria-label="スクリーンショット"
              >
                <Camera size={14} />
              </ActionIcon>
            </Tooltip>
            {pendingScreenshot && (
              <Badge
                size="xs"
                color="green"
                variant="dot"
                component="button"
                style={{ cursor: "pointer" }}
                onClick={() => useStore.getState().setPendingScreenshot(null)}
                title="クリックで添付を解除"
              >
                📸 添付済 ✕
              </Badge>
            )}
            <ModelSelector />
            <TokenUsageDisplay />
          </Group>

          {isStreaming ? (
            <Tooltip label="停止 (ESC)">
              <ActionIcon size="sm" color="red" variant="filled" onClick={onStop} aria-label="停止">
                <Square size={12} />
              </ActionIcon>
            </Tooltip>
          ) : (
            <Tooltip label="送信 (Enter)">
              <ActionIcon
                size="sm"
                color="indigo"
                variant="filled"
                disabled={!text.trim() && !pendingElement}
                onClick={handleSubmit}
                aria-label="送信"
              >
                <Send size={14} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Paper>
    </Box>
  );
}

function ModelSelector() {
  const provider = useStore((s) => s.settings.provider);
  const model = useStore((s) => s.settings.model);
  const isStreaming = useStore((s) => s.isStreaming);
  const setSettings = useStore((s) => s.setSettings);
  const providerInfo = PROVIDERS[provider];
  const currentModel = model || providerInfo.defaultModel;

  return (
    <Menu disabled={isStreaming} position="top-start">
      <Menu.Target>
        <UnstyledButton px={6} py={2} style={{ borderRadius: 4 }} className="hover-highlight">
          <Group gap={2}>
            <Text size="xs" c="dimmed" truncate maw={100}>
              {currentModel}
            </Text>
            <ChevronDown size={12} color="var(--mantine-color-dimmed)" />
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        {providerInfo.models.map((m) => (
          <Menu.Item
            key={m}
            onClick={() => setSettings({ model: m })}
            rightSection={m === currentModel ? <Check size={12} /> : null}
          >
            {m}
          </Menu.Item>
        ))}
        {provider === "local" && (
          <>
            <Menu.Divider />
            <Box px="xs" py={4}>
              <TextInput
                size="xs"
                placeholder="カスタムモデル名"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setSettings({ model: e.currentTarget.value });
                  }
                }}
              />
            </Box>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
