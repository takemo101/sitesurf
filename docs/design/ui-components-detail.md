# UIコンポーネント詳細設計

## 概要

`ui-ux-design.md` のコンポーネントツリーを具体化し、
各コンポーネントの JSX・状態・インタラクションを定義する。
既存拡張 の UI パターンを参考にしつつ、Mantine v9 + React で再構成する。

## Header

### 構成

```
┌──────────────────────────────────────────┐
│ [📋][+]  セッション名  [🗑][☀/🌙][⚙]    │
└──────────────────────────────────────────┘
  ↑    ↑    ↑             ↑  ↑     ↑
  履歴  新規  インライン    消去 テーマ 設定
              編集可能
```

### セッションタイトルのインライン編集

既存拡張 方式: クリックでテキスト→入力欄に切替。

```tsx
function SessionTitle() {
  const [editing, setEditing] = useState(false);
  const title = useStore((s) => s.activeSessionSnapshot?.title ?? "");
  const renameSession = useStore((s) => s.renameSession);
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setEditing(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  const commit = async (value: string) => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== title) {
      await renameSession(useStore.getState().activeSessionId!, trimmed);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <TextInput
        ref={inputRef}
        defaultValue={title}
        size="xs"
        w={180}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit(e.currentTarget.value);
          if (e.key === "Escape") setEditing(false);
        }}
        onBlur={(e) => commit(e.currentTarget.value)}
      />
    );
  }

  return (
    <UnstyledButton
      onClick={startEdit}
      px={6}
      py={2}
      style={{ borderRadius: 4, maxWidth: 160 }}
      className="hover-highlight"
    >
      <Text size="xs" truncate>
        {title || "新しい会話"}
      </Text>
    </UnstyledButton>
  );
}
```

### Header 全体

```tsx
function Header() {
  const isStreaming = useStore((s) => s.isStreaming);

  return (
    <Group
      px="sm"
      py={6}
      justify="space-between"
      style={{ borderBottom: "1px solid var(--mantine-color-default-border)", flexShrink: 0 }}
    >
      <Group gap={4}>
        <Tooltip label="セッション一覧">
          <ActionIcon variant="subtle" size="sm" onClick={openSessionList} disabled={isStreaming}>
            <History size={14} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="新規セッション">
          <ActionIcon variant="subtle" size="sm" onClick={createSession} disabled={isStreaming}>
            <Plus size={14} />
          </ActionIcon>
        </Tooltip>
        <SessionTitle />
      </Group>
      <Group gap={4}>
        <ModelLabel />
        <Tooltip label="会話をクリア">
          <ActionIcon variant="subtle" size="sm" onClick={clearChat} disabled={isStreaming}>
            <Trash2 size={14} />
          </ActionIcon>
        </Tooltip>
        <ThemeToggle />
        <Tooltip label="設定">
          <ActionIcon variant="subtle" size="sm" onClick={toggleSettings}>
            <Settings size={14} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Group>
  );
}
```

### ModelLabel

ヘッダー右側にプロバイダー/モデル名を小さく表示 (既存拡張 方式):

```tsx
function ModelLabel() {
  const provider = useStore((s) => s.settings.provider);
  const model = useStore((s) => s.settings.model);

  return (
    <Text size="10px" c="dimmed" truncate maw={120} title={`${provider}/${model}`}>
      {provider}
    </Text>
  );
}
```

## SessionList (モーダルダイアログ)

既存拡張 はモーダルダイアログでセッション一覧を表示。TandemWeb もこの方式を採用。
(前回のドロップダウン方式から変更)

### 構成

```
┌─────────────────────────────────────────┐
│ セッション一覧                     [✕]   │
├─────────────────────────────────────────┤
│ [古いセッションを削除 ▼]                 │
├─────────────────────────────────────────┤
│ 🔍 セッション検索...                     │
├─────────────────────────────────────────┤
│ 12 セッション · 156 メッセージ           │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ ページの内容を分析して...     現在   │ │
│ │ 3分前 · 12 messages                 │ │
│ │ このページの要約を教えて...         │ │  ← preview
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ ECサイトの価格比較            🗑     │ │
│ │ 1時間前 · 24 messages               │ │
│ │ 商品の価格を比較して...             │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ 🔒 別ウィンドウで使用中              │ │  ← ロック中
│ │ ログインフォーム自動入力             │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### SessionItem

```tsx
function SessionItem({ meta, isLocked, isCurrent, onSelect, onDelete }: SessionItemProps) {
  return (
    <Paper
      p="sm"
      radius="sm"
      withBorder
      onClick={() => !isLocked && onSelect()}
      style={{
        cursor: isLocked ? "not-allowed" : "pointer",
        opacity: isLocked ? 0.5 : 1,
        borderLeft: isCurrent ? "3px solid var(--mantine-color-indigo-5)" : undefined,
      }}
      className="hover-highlight"
    >
      <Group justify="space-between" mb={4}>
        <Group gap={6}>
          <Text size="sm" fw={600} truncate maw={220}>
            {meta.title}
          </Text>
          {isCurrent && (
            <Badge size="xs" color="indigo">
              現在
            </Badge>
          )}
          {isLocked && !isCurrent && (
            <Badge size="xs" color="red">
              🔒 ロック中
            </Badge>
          )}
        </Group>
        {!isLocked && (
          <ActionIcon
            variant="subtle"
            size="xs"
            color="red"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="show-on-hover"
          >
            <Trash2 size={12} />
          </ActionIcon>
        )}
      </Group>
      <Group gap="md" mb={4}>
        <Text size="xs" c="dimmed">
          {formatRelativeDate(meta.lastModified)}
        </Text>
        <Text size="xs" c="dimmed">
          {meta.messageCount} messages
        </Text>
      </Group>
      {meta.preview && (
        <Text size="xs" c="dimmed" lineClamp={2}>
          {meta.preview}
        </Text>
      )}
    </Paper>
  );
}
```

### 一括削除メニュー

既存拡張 方式のドロップダウン:

```tsx
<Menu>
  <Menu.Target>
    <Button variant="subtle" size="xs" leftSection={<Trash2 size={12} />}>
      古いセッションを削除
    </Button>
  </Menu.Target>
  <Menu.Dropdown>
    <Menu.Item color="red" onClick={() => deleteOlderThan(7)}>
      7日以上前
    </Menu.Item>
    <Menu.Item color="red" onClick={() => deleteOlderThan(30)}>
      30日以上前
    </Menu.Item>
    <Menu.Item color="red" onClick={() => deleteOlderThan(90)}>
      90日以上前
    </Menu.Item>
    <Menu.Divider />
    <Menu.Item color="red" onClick={deleteAll}>
      すべて削除
    </Menu.Item>
  </Menu.Dropdown>
</Menu>
```

### 空状態

セッションが0件の場合:

```tsx
<Stack align="center" py="xl" gap="sm">
  <MessageSquare size={32} color="var(--mantine-color-dimmed)" />
  <Text size="sm" c="dimmed">
    セッションがまだありません
  </Text>
</Stack>
```

### セッション検索の実装

クライアントサイドで `SessionMeta.title` と `SessionMeta.preview` に対して部分一致フィルタ。

```tsx
const [query, setQuery] = useState("");

const filtered = useMemo(() => {
  if (!query.trim()) return sessions;
  const q = query.toLowerCase();
  return sessions.filter(
    (s) => s.title.toLowerCase().includes(q) || s.preview.toLowerCase().includes(q),
  );
}, [sessions, query]);
```

セッション数が多い場合 (500件以上) のパフォーマンスが問題になったら、
`Fuse.js` のファジー検索への移行を検討する。v0.1 では部分一致で十分。

## WelcomeScreen

APIキー設定済み + セッション空の時に ChatArea 内に表示。

```tsx
function WelcomeScreen({ onPromptSelect }: { onPromptSelect: (prompt: string) => void }) {
  return (
    <Stack align="center" justify="center" h="100%" gap="lg" px="md">
      <Stack align="center" gap={4}>
        <Globe size={40} color="var(--mantine-color-indigo-5)" />
        <Title order={2} size="h3">
          TandemWeb
        </Title>
        <Text size="sm" c="dimmed">
          AIと一緒にWebを操作しよう
        </Text>
      </Stack>

      <Stack gap={8} w="100%" maw={320}>
        {SAMPLE_PROMPTS.map((sp) => (
          <UnstyledButton
            key={sp.label}
            onClick={() => onPromptSelect(sp.prompt)}
            px="md"
            py="sm"
            style={{
              border: "1px solid var(--mantine-color-default-border)",
              borderRadius: 20,
              textAlign: "center",
            }}
            className="hover-highlight sample-prompt-pill"
          >
            <Text size="sm">{sp.label}</Text>
          </UnstyledButton>
        ))}
      </Stack>
    </Stack>
  );
}
```

### サンプルプロンプトのアニメーション

既存拡張 のように staggered fade-in:

```css
.sample-prompt-pill {
  animation: fadeInUp 0.3s ease forwards;
  opacity: 0;
}
.sample-prompt-pill:nth-child(1) {
  animation-delay: 0s;
}
.sample-prompt-pill:nth-child(2) {
  animation-delay: 0.1s;
}
.sample-prompt-pill:nth-child(3) {
  animation-delay: 0.2s;
}
.sample-prompt-pill:nth-child(4) {
  animation-delay: 0.3s;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

## NavigationMessage

タブ遷移時にチャットに表示するメッセージ。既存拡張 の NavigationMessage と同等。

```tsx
function NavigationBubble({ msg }: { msg: ChatMessage }) {
  const faviconUrl = msg.favicon || getFallbackFavicon(msg.url!);

  return (
    <UnstyledButton
      onClick={() => chrome.tabs.create({ url: msg.url! })}
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
        {msg.content}
      </Text>
    </UnstyledButton>
  );
}

function getFallbackFavicon(url: string): string {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`;
  } catch {
    return "";
  }
}
```

## MessageBubble (詳細)

### role別の表示切替

```tsx
function MessageBubble({ msg }: { msg: ChatMessage }) {
  switch (msg.role) {
    case "navigation":
      return <NavigationBubble msg={msg} />;
    case "system":
      return <SystemMessage msg={msg} />;
    case "error":
      return <ErrorMessage msg={msg} />;
    default:
      return <ChatBubble msg={msg} />;
  }
}
```

### ChatBubble (user / assistant)

```tsx
function ChatBubble({ msg }: { msg: ChatMessage }) {
  const config = roleConfig[msg.role as "user" | "assistant"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
    >
      <Paper
        p="xs"
        radius="sm"
        withBorder
        bg={messageStyles[msg.role].bg}
        style={{ borderColor: messageStyles[msg.role].borderColor }}
      >
        {/* ロールラベル */}
        <Group gap={6} mb={4}>
          <config.icon size={12} />
          <Text size="10px" fw={600} tt="uppercase" c="dimmed">
            {config.label}
          </Text>
        </Group>

        {/* 本文 (Markdown) */}
        <MarkdownContent content={msg.content} />

        {/* 添付画像 (user のみ) */}
        {msg.image && (
          <Image
            src={msg.image}
            radius="sm"
            mt={4}
            maw={300}
            style={{ border: "1px solid var(--mantine-color-default-border)" }}
          />
        )}

        {/* ツール呼出し (assistant のみ) */}
        {msg.toolCalls?.map((tc) => (
          <ToolCallBlock key={tc.id} tc={tc} />
        ))}
      </Paper>
    </motion.div>
  );
}
```

### SystemMessage

```tsx
function SystemMessage({ msg }: { msg: ChatMessage }) {
  return (
    <Text size="xs" c="dimmed" ta="center" py={4} px="sm">
      {msg.content}
    </Text>
  );
}
```

### ErrorMessage

```tsx
function ErrorMessage({ msg }: { msg: ChatMessage }) {
  return (
    <Paper
      p="xs"
      radius="sm"
      withBorder
      bg="var(--mantine-color-red-light)"
      style={{ borderColor: "var(--mantine-color-red-outline)" }}
    >
      <Group gap={6} mb={4}>
        <AlertCircle size={12} color="var(--mantine-color-red-5)" />
        <Text size="10px" fw={600} tt="uppercase" c="red">
          エラー
        </Text>
      </Group>
      <Text size="xs" c="red">
        {msg.content}
      </Text>
    </Paper>
  );
}
```

## ToolCallBlock (詳細)

### 3状態

```tsx
function ToolCallBlock({ tc }: { tc: ToolCallInfo }) {
  const [expanded, setExpanded] = useState(!tc.success); // 失敗時はデフォルト展開

  const statusIcon = tc.isRunning ? (
    <Loader size={10} type="dots" />
  ) : tc.success ? (
    <CheckCircle size={12} color="var(--mantine-color-green-5)" />
  ) : (
    <XCircle size={12} color="var(--mantine-color-red-5)" />
  );

  const inputStr = tc.input.code
    ? String(tc.input.code)
    : Object.keys(tc.input).length > 0
      ? JSON.stringify(tc.input, null, 2)
      : null;

  return (
    <Paper
      mt={6}
      radius="sm"
      withBorder
      style={{ borderColor: "var(--mantine-color-default-border)" }}
    >
      {/* ヘッダー (常に表示) */}
      <UnstyledButton
        onClick={() => !tc.isRunning && setExpanded(!expanded)}
        w="100%"
        px="xs"
        py={6}
        style={{ display: "flex", alignItems: "center", gap: 6 }}
      >
        <Terminal size={12} color="var(--mantine-color-indigo-5)" />
        <Text size="xs" fw={600} c="indigo">
          {tc.name}
        </Text>
        {tc.input.description && (
          <Text size="xs" c="dimmed" truncate style={{ flex: 1 }}>
            {tc.input.description}
          </Text>
        )}
        {statusIcon}
        {!tc.isRunning && (expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
      </UnstyledButton>

      {/* 展開コンテンツ */}
      <Collapse expanded={expanded}>
        <Box px="xs" pb="xs">
          {inputStr && (
            <Code block style={{ fontSize: 11, maxHeight: 150, overflow: "auto" }}>
              {inputStr}
            </Code>
          )}
          {tc.result && (
            <Box
              mt={4}
              pt={4}
              style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}
            >
              <Text
                size="xs"
                c={tc.success ? "green" : "red"}
                style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}
              >
                {tc.result.substring(0, 500)}
                {tc.result.length > 500 && "..."}
              </Text>
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}
```

## MarkdownContent

AI 応答の Markdown レンダリング。

```tsx
function MarkdownContent({ content }: { content: string }) {
  return (
    <Box className="markdown-content">
      <ReactMarkdown
        components={{
          code: ({ children, className }) => {
            const isBlock = className?.startsWith("language-");
            if (isBlock) {
              return (
                <Box my={4} style={{ position: "relative" }}>
                  <Code block style={{ fontSize: 11 }}>
                    {String(children)}
                  </Code>
                  <CopyButton value={String(children)}>
                    {({ copied, copy }) => (
                      <ActionIcon
                        variant="subtle"
                        size="xs"
                        style={{ position: "absolute", top: 4, right: 4 }}
                        onClick={copy}
                      >
                        {copied ? <Check size={10} /> : <Copy size={10} />}
                      </ActionIcon>
                    )}
                  </CopyButton>
                </Box>
              );
            }
            return <Code style={{ fontSize: 12 }}>{String(children)}</Code>;
          },
          p: ({ children }) => (
            <Text size="sm" mb={4}>
              {children}
            </Text>
          ),
          ul: ({ children }) => (
            <Box component="ul" ml="md" style={{ fontSize: 13 }}>
              {children}
            </Box>
          ),
          ol: ({ children }) => (
            <Box component="ol" ml="md" style={{ fontSize: 13 }}>
              {children}
            </Box>
          ),
          a: ({ href, children }) => (
            <Anchor href={href} target="_blank" size="sm">
              {children}
            </Anchor>
          ),
          h1: ({ children }) => (
            <Title order={4} mb={4}>
              {children}
            </Title>
          ),
          h2: ({ children }) => (
            <Title order={5} mb={4}>
              {children}
            </Title>
          ),
          h3: ({ children }) => (
            <Title order={6} mb={4}>
              {children}
            </Title>
          ),
          table: ({ children }) => (
            <Table striped withTableBorder withColumnBorders my={4} style={{ fontSize: 12 }}>
              {children}
            </Table>
          ),
          blockquote: ({ children }) => (
            <Blockquote color="gray" my={4} style={{ fontSize: 13 }}>
              {children}
            </Blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </Box>
  );
}
```

### コードブロックのスタイリング

```css
.markdown-content pre {
  margin: 4px 0;
  border-radius: 6px;
}
.markdown-content code {
  font-family: "SF Mono", "Fira Code", monospace;
}
.markdown-content img {
  max-width: 100%;
  border-radius: 6px;
}
```

## InputArea (詳細)

### ストリーミング中の送信/停止ボタン切替

```tsx
function InputArea({ onSend, onStop }: { onSend: (text: string) => void; onStop: () => void }) {
  const [text, setText] = useState("");
  const isStreaming = useStore((s) => s.isStreaming);
  const pendingScreenshot = useStore((s) => s.pendingScreenshot);

  return (
    <Box style={{ borderTop: "1px solid var(--mantine-color-default-border)", flexShrink: 0 }}>
      {/* アクションボタン行 */}
      <Group gap={4} px="xs" pt={6}>
        <Tooltip label="ページ読取">
          <ActionIcon variant="subtle" size="sm" onClick={handleReadPage} disabled={isStreaming}>
            <FileText size={14} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="要素選択">
          <ActionIcon variant="subtle" size="sm" onClick={handlePickElement} disabled={isStreaming}>
            <MousePointer2 size={14} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="スクリーンショット">
          <ActionIcon variant="subtle" size="sm" onClick={handleScreenshot}>
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
      </Group>

      {/* 入力 + 送信/停止 */}
      <Group gap={6} px="xs" pb="xs" pt={4} align="flex-end">
        <Textarea
          flex={1}
          placeholder="AIに指示を入力... (Ctrl+Enterで送信)"
          minRows={2}
          maxRows={6}
          autosize
          value={text}
          onChange={(e) => setText(e.currentTarget.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            }
          }}
          disabled={isStreaming}
        />
        {isStreaming ? (
          <Tooltip label="停止 (ESC)">
            <ActionIcon size="lg" color="red" variant="filled" onClick={onStop}>
              <Square size={14} />
            </ActionIcon>
          </Tooltip>
        ) : (
          <Tooltip label="送信 (Ctrl+Enter)">
            <ActionIcon
              size="lg"
              color="indigo"
              variant="filled"
              disabled={!text.trim()}
              onClick={handleSubmit}
            >
              <Send size={16} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
    </Box>
  );
}
```

### ElementCard (要素選択結果カード)

要素選択後に InputArea の上部に表示されるカード。
ユーザーの指示入力とは分離し、送信時に自動的にメッセージに合成される。

```
┌─────────────────────────────────────────────┐
│ 🎯 <h2> MacBook Pro 14インチ          [✕]   │  ← ヘッダー (タグ + テキスト + 閉じる)
│ div.product-card > h2.title                  │  ← セレクタ (mono, muted)
│ [▼ 周辺DOM]                                  │  ← 折りたたみ (デフォルト閉)
├─────────────────────────────────────────────┤
│ [この要素に対する指示を入力...]          [▶]  │  ← 通常の入力欄
└─────────────────────────────────────────────┘
```

```tsx
function ElementCard({ element, onDismiss }: { element: ElementInfo; onDismiss: () => void }) {
  const [showDOM, setShowDOM] = useState(false);

  return (
    <Paper
      p="xs"
      mx="xs"
      mt={6}
      radius="sm"
      withBorder
      style={{ borderColor: "var(--mantine-color-indigo-outline)" }}
    >
      {/* ヘッダー: タグ + テキスト + 閉じる */}
      <Group justify="space-between" mb={2}>
        <Group gap={6}>
          <MousePointer2 size={12} color="var(--mantine-color-indigo-5)" />
          <Text size="xs" fw={600}>
            {"<"}
            {element.tagName}
            {">"}
          </Text>
          <Text size="xs" c="dimmed" truncate maw={200}>
            {element.text?.substring(0, 50) || "(テキストなし)"}
          </Text>
        </Group>
        <ActionIcon variant="subtle" size="xs" onClick={onDismiss}>
          <X size={10} />
        </ActionIcon>
      </Group>

      {/* セレクタ */}
      <Code style={{ fontSize: 10 }}>{element.selector}</Code>

      {/* 周辺DOM (折りたたみ) */}
      {element.surroundingHTML && (
        <>
          <UnstyledButton onClick={() => setShowDOM(!showDOM)} mt={4}>
            <Group gap={4}>
              {showDOM ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              <Text size="xs" c="dimmed">
                周辺DOM
              </Text>
            </Group>
          </UnstyledButton>
          <Collapse expanded={showDOM}>
            <Code block style={{ fontSize: 10, maxHeight: 120, overflow: "auto" }} mt={4}>
              {element.surroundingHTML}
            </Code>
          </Collapse>
        </>
      )}
    </Paper>
  );
}
```

### InputArea に ElementCard を統合

```tsx
function InputArea({ onSend, onStop }: Props) {
  const [text, setText] = useState("");
  const [pendingElement, setPendingElement] = useState<ElementInfo | null>(null);
  // ...

  const handleSubmit = () => {
    if (!text.trim() && !pendingElement) return;

    // 要素情報 + ユーザー指示を合成してメッセージとして送信
    let messageText = text.trim();
    if (pendingElement) {
      const elementContext = [
        `[選択された要素]`,
        `セレクタ: ${pendingElement.selector}`,
        `タグ: <${pendingElement.tagName}>`,
        `テキスト: ${pendingElement.text?.substring(0, 100) || "(なし)"}`,
        pendingElement.surroundingHTML ? `\n周辺DOM:\n${pendingElement.surroundingHTML}` : "",
        "",
        messageText,
      ].filter(Boolean).join("\n");
      messageText = elementContext;
      setPendingElement(null);
    }

    onSend(messageText);
    setText("");
  };

  return (
    <Box style={{ borderTop: "1px solid var(--mantine-color-default-border)", flexShrink: 0 }}>
      {/* 要素選択カード (選択中のみ表示) */}
      {pendingElement && (
        <ElementCard element={pendingElement} onDismiss={() => setPendingElement(null)} />
      )}

      {/* アクションボタン行 */}
      <Group gap={4} px="xs" pt={6}>
        {/* ... 📄 🎯 📸 ボタン ... */}
      </Group>

      {/* 入力 + 送信 */}
      <Group gap={6} px="xs" pb="xs" pt={4} align="flex-end">
        <Textarea
          placeholder={pendingElement ? "この要素に対する指示を入力..." : "AIに指示を入力... (Ctrl+Enterで送信)"}
          {/* ... */}
        />
        {/* 送信/停止ボタン */}
      </Group>
    </Box>
  );
}
```

### 送信時のメッセージ構造

ユーザーが要素を選択して「この商品の価格を教えて」と入力した場合、
AIに送信されるメッセージ:

```
[選択された要素]
セレクタ: div.product-card > h2.title
タグ: <h2>
テキスト: MacBook Pro 14インチ

周辺DOM:
<div class="product-card featured">
  <img src="/img/macbook.jpg" alt="MacBook">
  <h2 class="title">MacBook Pro 14インチ</h2>
  <span class="price">¥298,800</span>
  <button class="add-to-cart">カートに入れる</button>
</div>

この商品の価格を教えて
```

AIは周辺DOMから `<span class="price">¥298,800</span>` を認識し、
read_page を呼ばずに回答できる。

### pendingElement の状態管理

`pendingElement` は InputArea のローカル state (`useState`) で管理する。

| 状態              | 管理場所            | 理由                                       |
| ----------------- | ------------------- | ------------------------------------------ |
| pendingElement    | ローカル `useState` | InputArea 内でのみ使用。送信後にクリア     |
| pendingScreenshot | Zustand UISlice     | 📸ボタンとシステムメッセージの両方から参照 |

pendingElement はローカルに閉じるが、pendingScreenshot はシステムメッセージ表示が
ChatArea 側にあるためグローバル。

## SettingsPanel (詳細)

### プロバイダー切替時のUI遷移

プロバイダーを切り替えると、表示する入力欄が動的に変わる。

```tsx
function SettingsPanel() {
  const settings = useStore((s) => s.settings);
  const provider = PROVIDERS[settings.provider];

  return (
    <Collapse expanded={settingsOpen}>
      <Stack gap="xs" p="sm"
        style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}
      >
        <Text size="xs" fw={600}>AI設定</Text>

        {/* プロバイダー選択 (常に表示) */}
        <ProviderSelect />

        {/* モデル選択 (常に表示、形式はプロバイダーで変わる) */}
        {provider.models.length > 0
          ? <Select label="モデル" data={provider.models} ... />
          : <TextInput label="モデル名" placeholder={provider.defaultModel} ... />
        }

        {/* APIキー (apikey方式のプロバイダーのみ) */}
        {showApiKey && <PasswordInput label="APIキー" ... />}

        {/* エンドポイントURL (ローカルLLMのみ) */}
        {showBaseUrl && <TextInput label="エンドポイントURL" ... />}

        {/* OAuth (oauth方式のプロバイダーのみ) */}
        {showOAuth && <OAuthSection />}

        <Group gap="xs" mt={4}>
          <Button size="xs" onClick={saveSettings}>保存</Button>
          <Button size="xs" variant="subtle" onClick={close}>閉じる</Button>
        </Group>
      </Stack>
    </Collapse>
  );
}
```

### Skills タブ

SettingsPanel は `ai` / `skills` / `system` のタブ構成を持ち、`skills` タブで custom skill 編集と chat 起点の draft 承認を扱う。

```tsx
<Tabs.Panel value="skills" pt="xs" style={{ flex: 1, minHeight: 0 }}>
  <Box style={PANEL_SCROLL_STYLE}>
    <SkillsEditor />
  </Box>
</Tabs.Panel>
```

`SkillsEditor` の先頭には draft セクションを置く。chat から `create_skill_draft` が呼ばれると、下書きは custom skill 一覧には混ぜず、このセクションにだけ表示する。

```tsx
<Stack gap={6}>
  <Group gap="xs" justify="space-between" align="center">
    <Text size="xs" fw={600}>下書き</Text>
    <Badge size="xs" variant="light" color="gray">{skillDrafts.length}</Badge>
  </Group>

  {skillDrafts.length === 0 ? (
    <Paper withBorder p="md" radius="sm">
      <Text size="xs" c="dimmed">
        チャットから作成した skill draft はまだありません
      </Text>
    </Paper>
  ) : (
    skillDrafts.map((draft) => <SkillDraftCard key={draft.draftId} draft={draft} ... />)
  )}
</Stack>
```

### SkillDraftCard

各 draft card は以下を表示する:

- Skill 名
- validation status (`OK` / `警告あり` / `要修正`)
- suggested fixes
- 承認前プレビュー
- `承認保存` / `破棄` ボタン

`承認保存` は `reject` 状態では無効化する。成功時のみ draft を削除し、custom skill ストアへ移動して registry reload を通知する。

```tsx
<Button
  size="compact-xs"
  variant="light"
  onClick={() => onApprove(draft.draftId)}
  disabled={draft.validation.status === "reject"}
>
  承認保存
</Button>
<Button
  size="compact-xs"
  color="red"
  variant="subtle"
  onClick={() => onDiscard(draft.draftId)}
>
  破棄
</Button>
```

validation の表示は Alert でまとめる。`reject` は赤、`warning` は黄で見せる。preview は read-only の `Textarea` に整形済みテキストを表示し、保存前に構造を見直せるようにする。

### OAuthSection

```tsx
function OAuthSection() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const [status, setStatus] = useState<"idle" | "logging-in" | "error">("idle");
  const [deviceCode, setDeviceCode] = useState<DeviceCodeInfo | null>(null);

  if (settings.credentials) {
    return (
      <>
        <Divider label="OAuth" labelPosition="center" />
        <Group gap="xs">
          <Badge color="green" variant="dot">
            接続済み
          </Badge>
          {settings.credentials.metadata?.enterpriseDomain && (
            <Text size="xs" c="dimmed">
              {settings.credentials.metadata.enterpriseDomain}
            </Text>
          )}
          <Button variant="subtle" size="xs" color="red" onClick={disconnect}>
            切断
          </Button>
        </Group>
      </>
    );
  }

  return (
    <>
      <Divider label="または" labelPosition="center" />

      {/* Copilot: Enterprise ドメイン入力 */}
      {settings.provider === "copilot" && (
        <TextInput
          label="GitHub Enterprise ドメイン (個人版は空欄)"
          placeholder="github.example.com"
          size="xs"
          value={settings.enterpriseDomain || ""}
          onChange={(e) => setSettings({ enterpriseDomain: e.currentTarget.value })}
        />
      )}

      <Button variant="light" size="xs" onClick={handleOAuth} loading={status === "logging-in"}>
        {settings.provider === "copilot" ? "GitHubでログイン" : "OpenAIでログイン"}
      </Button>

      {/* Copilot Device Code 表示 */}
      {deviceCode && (
        <Paper p="sm" radius="sm" withBorder ta="center">
          <Text size="xs" c="dimmed" mb={4}>
            以下のコードをブラウザで入力:
          </Text>
          <Text size="xl" fw={700} c="indigo" style={{ fontFamily: "monospace", letterSpacing: 3 }}>
            {deviceCode.userCode}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            コードの有効期限: {Math.floor(deviceCode.expiresIn / 60)}分
          </Text>
        </Paper>
      )}

      {status === "error" && (
        <Text size="xs" c="red">
          認証に失敗しました。再度お試しください。
        </Text>
      )}
    </>
  );
}
```

**Copilot のログイン時、`settings.enterpriseDomain` を `CopilotAuth.login()` に渡す:**

```tsx
const handleOAuth = async () => {
  // ...
  if (settings.provider === "copilot") {
    const creds = await auth.login(
      { onDeviceCode: setDeviceCode, onProgress: ... },
      settings.enterpriseDomain || undefined,  // GHES ドメインを渡す
    );
    // ...
  }
};
```

## エラー状態のUI

### APIキー未設定時

設定パネルが自動で開き、ウェルカムメッセージが表示される。
既存拡張 の WelcomeSetupDialog に相当。

```
┌────────────────────────────────────┐
│ AI設定                              │
│                                    │
│ AIプロバイダーを設定してください。     │
│ APIキーを入力するか、OAuthで         │
│ ログインしてください。               │
│                                    │
│ [プロバイダー ▼] Anthropic          │
│ [APIキー     ] sk-ant-...          │
│                                    │
│ [保存]                              │
└────────────────────────────────────┘
```

### ストリーミング中にAPIキーが無効と判明

エラーメッセージ + 設定パネルを開くリンク:

```tsx
function ErrorMessage({ msg }: { msg: ChatMessage }) {
  const isAuthError = msg.errorCode === "ai_auth_invalid";

  return (
    <Paper ...>
      <Text size="xs" c="red">{msg.content}</Text>
      {isAuthError && (
        <Button variant="subtle" size="xs" mt={4} onClick={openSettings}>
          設定を開く
        </Button>
      )}
    </Paper>
  );
}
```

### ネットワーク切断

リトライ中はシステムメッセージで表示:

```
│ ⏳ API接続をリトライ中... (1回目, 2秒後) │
```

リトライ失敗:

```
│ ❌ AIサービスに接続できません。           │
│    ネットワーク接続を確認してください。    │
```

## ローディング状態

### 初回起動

```tsx
function App() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    initializeApp().then(() => setInitialized(true));
  }, []);

  if (!initialized) {
    return (
      <Stack align="center" justify="center" h="100vh">
        <Loader size="md" color="indigo" />
      </Stack>
    );
  }

  return ( /* メインUI */ );
}
```

### セッション切替

切替中は ChatArea にローダーを表示:

```tsx
function ChatArea() {
  const loading = useStore((s) => s.sessionLoading);

  if (loading) {
    return (
      <Stack align="center" justify="center" flex={1}>
        <Loader size="sm" color="indigo" />
        <Text size="xs" c="dimmed">
          セッション読み込み中...
        </Text>
      </Stack>
    );
  }

  // ... メッセージ表示
}
```

## トースト通知

Mantine の `notifications` を使用。

| イベント               | トースト                            | 色    |
| ---------------------- | ----------------------------------- | ----- |
| 設定保存成功           | 「設定を保存しました」              | green |
| OAuth接続成功          | 「OpenAI に接続しました」           | green |
| OAuth切断              | 「接続を解除しました」              | blue  |
| OAuth失敗              | 「認証に失敗しました: {error}」     | red   |
| セッション削除         | 「セッションを削除しました」        | blue  |
| 古いセッション一括削除 | 「{n}件のセッションを削除しました」 | blue  |

```tsx
notifications.show({
  title: "設定を保存しました",
  message: "",
  color: "green",
  autoClose: 3000,
});
```

## テーマ切替のCSS トランジション

既存拡張 方式: 全要素にスムーズなカラートランジションを適用。

```css
/* sidepanel/styles.css */
*,
*::before,
*::after {
  transition:
    background-color 0.3s ease,
    color 0.3s ease,
    border-color 0.3s ease;
}
```

## 送信前のナビゲーション挿入

既存拡張 の `onBeforeSend` パターン: ユーザーがメッセージを送信する直前に、
現在のタブURLが最新のナビゲーションメッセージと異なっていれば、
NavigationMessage を自動挿入する。

```typescript
// sidepanel/App.tsx (handleSend 内)
async function handleSend(text: string) {
  // 送信前にタブ状態を確認し、必要ならナビゲーションメッセージを挿入
  const tab = await deps.browserExecutor.getActiveTab();
  const lastNavUrl = getLastNavigationUrl(chatStore.getMessages());

  if (tab.url && tab.url !== lastNavUrl && !tab.url.startsWith("chrome-extension://")) {
    chatStore.addNavigationMessage({
      url: tab.url,
      title: tab.title || "Untitled",
    });
  }

  // ユーザーメッセージ追加 + agent-loop 起動
  chatStore.addUserMessage(text, pendingScreenshot);
  // ...
}
```

## store → コンポーネントの接続パターン

### セレクターでsubscribe

```tsx
// ✅ 必要な値だけ subscribe
const messages = useStore((s) => s.messages);
const isStreaming = useStore((s) => s.isStreaming);
```

### DI (useDeps) でPort取得

```tsx
// ✅ Adapter はコンポーネントで使わず、ハンドラ経由
function InputArea() {
  const deps = useDeps(); // BrowserExecutor 等

  const handlePickElement = async () => {
    const tab = await deps.browserExecutor.getActiveTab();
    if (!tab.id) return;

    useStore.getState().addSystemMessage("🎯 ページ上の要素をクリックして選択してください...");
    const result = await deps.browserExecutor.injectElementPicker(tab.id);

    if (!result.ok || !result.value) {
      if (!result.ok) {
        notifications.show({ title: "エラー", message: result.error.message, color: "red" });
      } else {
        useStore.getState().addSystemMessage("要素選択がキャンセルされました");
      }
      return;
    }

    // 要素情報を pendingElement にセットし、InputArea 上部にカード表示
    setPendingElement(result.value);
    setText("");
    textareaRef.current?.focus();
  };
}
```

### ローカル state vs グローバル state

| 状態                            | 管理場所             | 理由                                   |
| ------------------------------- | -------------------- | -------------------------------------- |
| テキスト入力値                  | ローカル `useState`  | InputArea 内でしか使わない             |
| 設定パネル開閉                  | Zustand UISlice      | Header と SettingsPanel の両方から参照 |
| セッション一覧ダイアログ開閉    | ローカル `useState`  | Header 内で完結                        |
| ToolCallBlock の展開/折りたたみ | ローカル `useState`  | 各ブロック内で完結                     |
| タイトル編集モード              | ローカル `useState`  | SessionTitle 内で完結                  |
| OAuth ローディング状態          | ローカル `useState`  | OAuthSection 内で完結                  |
| セッション読み込み中            | Zustand SessionSlice | ChatArea から参照                      |

## hover-highlight ユーティリティ

テーマ対応のホバーエフェクト:

```css
.hover-highlight {
  transition: background-color 0.15s ease;
}
.hover-highlight:hover {
  background-color: var(--mantine-color-default-hover);
}
```

## show-on-hover ユーティリティ

親ホバー時のみ表示 (削除ボタン等):

```css
.show-on-hover {
  opacity: 0;
  transition: opacity 0.15s ease;
}
*:hover > .show-on-hover {
  opacity: 1;
}
```

## ThemeToggle (3状態サイクル)

`auto → light → dark → auto` の3状態をサイクルで切り替える。

```tsx
function ThemeToggle() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const computedScheme = useComputedColorScheme("dark");

  const cycle = () => {
    // auto → light → dark → auto
    const next: Record<string, "auto" | "light" | "dark"> = {
      auto: "light",
      light: "dark",
      dark: "auto",
    };
    const nextScheme = next[colorScheme] ?? "auto";
    setColorScheme(nextScheme);
    // chrome.storage に永続化
    deps.storage.set("tandemweb_theme", nextScheme);
  };

  const icons: Record<string, React.ReactNode> = {
    auto: <Monitor size={14} />,
    light: <Sun size={14} />,
    dark: <Moon size={14} />,
  };

  const labels: Record<string, string> = {
    auto: "システム設定に追従中",
    light: "ライトモード",
    dark: "ダークモード",
  };

  return (
    <Tooltip label={labels[colorScheme]}>
      <ActionIcon variant="subtle" size="sm" color="gray" onClick={cycle}>
        {icons[colorScheme]}
      </ActionIcon>
    </Tooltip>
  );
}
```

## MarkdownContent のコードブロック言語名表示

言語指定されたコードブロック (` ```javascript `) に言語名ヘッダーを表示する。

```tsx
// MarkdownContent 内の code コンポーネント (抜粋)

code: ({ children, className }) => {
  const match = className?.match(/language-(\w+)/);
  const lang = match?.[1];

  if (lang) {
    return (
      <Box my={4} style={{ position: "relative" }}>
        {/* 言語名ヘッダー */}
        <Group px="xs" py={2} gap={4}
          style={{
            borderTopLeftRadius: 6, borderTopRightRadius: 6,
            border: "1px solid var(--mantine-color-default-border)",
            borderBottom: "none",
          }}
        >
          <Text size="10px" fw={600} c="dimmed" tt="uppercase">{lang}</Text>
          <Box style={{ flex: 1 }} />
          <CopyButton value={String(children)}>
            {({ copied, copy }) => (
              <ActionIcon variant="subtle" size="xs" onClick={copy}>
                {copied ? <Check size={10} /> : <Copy size={10} />}
              </ActionIcon>
            )}
          </CopyButton>
        </Group>
        {/* コード本体 */}
        <Code block style={{
          fontSize: 11,
          borderTopLeftRadius: 0, borderTopRightRadius: 0,
        }}>
          {String(children)}
        </Code>
      </Box>
    );
  }

  // インラインコード
  return <Code style={{ fontSize: 12 }}>{String(children)}</Code>;
},
```

## SessionListModal の切替動線

### セッション選択時のフロー

```
SessionItem クリック
  → onSelect(sessionId) コールバック
  → モーダルを即座に閉じる
  → ChatArea に LoadingState 表示
  → sessionStorage.getSession(id)
  → acquireLock(id, windowId)
    ├─ 成功 → ChatSlice に messages/history をロード → LoadingState 消去
    └─ 失敗 → エラートースト「このセッションは別のウィンドウで使用中です」
```

```tsx
// SessionListModal
function handleSelect(sessionId: string) {
  closeModal(); // 即座に閉じる
  switchSession(sessionId); // 非同期で切替開始
}
```

### 削除の確認ダイアログ

destructive 操作には Mantine の `modals.openConfirmModal` を使用。

```tsx
import { modals } from "@mantine/modals";

function handleDeleteSession(id: string, title: string) {
  modals.openConfirmModal({
    title: "セッションの削除",
    children: <Text size="sm">「{title}」を削除しますか？この操作は取り消せません。</Text>,
    labels: { confirm: "削除", cancel: "キャンセル" },
    confirmProps: { color: "red" },
    onConfirm: () => deleteSession(id),
  });
}

function handleDeleteOlderThan(days: number) {
  const count = sessions.filter((s) => isOlderThan(s.lastModified, days)).length;
  modals.openConfirmModal({
    title: "古いセッションの削除",
    children: (
      <Text size="sm">
        {days}日以上前の{count}件のセッションを削除しますか？
      </Text>
    ),
    labels: { confirm: `${count}件削除`, cancel: "キャンセル" },
    confirmProps: { color: "red" },
    onConfirm: () => deleteSessionsOlderThan(days),
  });
}
```

**注意:** `@mantine/modals` パッケージの追加インストールと、
`sidepanel/main.tsx` で `<ModalsProvider>` のラップが必要。

## 関連ドキュメント

- [UI/UX設計](./ui-ux-design.md) - レイアウト、テーマ、アクセシビリティ
- [機能仕様](./feature-spec.md) - 各機能の振る舞い
- [agent-loop 詳細設計](./agent-loop-detail.md) - ChatActions のinterface
- [セッション管理](./session-management-detail.md) - セッション一覧データ
