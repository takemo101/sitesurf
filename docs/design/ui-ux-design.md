# UI/UX 設計

## 設計方針

**Chrome拡張サイドパネルの狭い横幅 (約400px) に最適化する。**
情報密度を高く、操作ステップを少なく。
Mantine v9 のテーマシステムを使い、ダーク/ライト切替に対応する。

**本ドキュメントはレイアウト・テーマ・方針を定める。各コンポーネントのJSX詳細は
[UIコンポーネント詳細設計](./ui-components-detail.md) を参照。**

## テーマ設計

### テーマ切替方式

Mantine の `useMantineColorScheme` を使用。3状態をサイクルで切り替える。

| 方式                  | 説明                    | アイコン     |
| --------------------- | ----------------------- | ------------ |
| **auto** (デフォルト) | OS のシステム設定に追従 | 🖥️ (Monitor) |
| **light**             | 固定ライトモード        | ☀️ (Sun)     |
| **dark**              | 固定ダークモード        | 🌙 (Moon)    |

ユーザーはヘッダーのテーマ切替ボタンで `auto → light → dark → auto` をサイクル。
選択は `chrome.storage.local` に永続化。

### MantineProvider 設定

```tsx
// sidepanel/main.tsx
<MantineProvider
  defaultColorScheme="auto"
  theme={{
    primaryColor: "indigo",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSizes: { xs: "11px", sm: "12px", md: "13px", lg: "14px", xl: "16px" },
  }}
>
```

### カラートークン方針

**コンポーネント内で `dark.7`, `#1a1a1e` 等のハードコードをしない。**
Mantine の CSS 変数またはセマンティックな props を使う。

```tsx
// ❌ テーマ切替で壊れる
<Paper bg="dark.7">

// ✅ テーマ追従
<Paper bg="var(--mantine-color-body)">
<Paper withBorder>
<Text c="dimmed">
```

### セマンティックカラー対応表

| 用途            | Mantine CSS変数 / props               | Dark      | Light     |
| --------------- | ------------------------------------- | --------- | --------- |
| 背景            | `var(--mantine-color-body)`           | `#1a1b1e` | `#ffffff` |
| サーフェス      | `var(--mantine-color-default)`        | `#25262b` | `#ffffff` |
| ボーダー        | `var(--mantine-color-default-border)` | `#373a40` | `#dee2e6` |
| テキスト        | `var(--mantine-color-text)`           | `#c1c2c5` | `#000000` |
| テキスト(muted) | `c="dimmed"`                          | `#909296` | `#868e96` |
| プライマリ      | `color="indigo"`                      | indigo.5  | indigo.6  |
| エラー          | `color="red"`                         | red.5     | red.6     |
| 成功            | `color="green"`                       | green.5   | green.6   |

### メッセージバブルの色

```tsx
// features/chat/theme.ts

export const messageStyles = {
  user: {
    bg: "var(--mantine-color-indigo-light)",
    borderColor: "var(--mantine-color-indigo-outline)",
  },
  assistant: {
    bg: "var(--mantine-color-default)",
    borderColor: "var(--mantine-color-default-border)",
  },
  system: {
    bg: "transparent",
    borderColor: "transparent",
  },
  error: {
    bg: "var(--mantine-color-red-light)",
    borderColor: "var(--mantine-color-red-outline)",
  },
  // navigation は NavigationBubble で個別スタイル (messageStyles を参照しない)
} as const;

export type StyledRole = keyof typeof messageStyles;
```

`navigation` ロールは `MessageBubble` の switch 分岐で `NavigationBubble` に委譲されるため、
`messageStyles` には含めない。`ChatBubble` は `StyledRole` 型でのみ `messageStyles` にアクセスする。

## レイアウト構造

```
┌─── 400px ──────────────────────┐
│ Header          48px  固定      │
├─────────────────────────────────┤
│ SettingsPanel         可変      │  ← 折りたたみ (Collapse)
├─────────────────────────────────┤
│ TabBar          28px  固定      │
├─────────────────────────────────┤
│                                 │
│ ChatArea              flex:1    │  ← スクロール
│                                 │
├─────────────────────────────────┤
│ InputArea       可変  固定      │  ← autosize (2-6行)
└─────────────────────────────────┘

SessionListModal は Header のボタンで開くモーダルダイアログ (レイアウト外)
```

全体は `flex-direction: column` の `100vh` レイアウト。
ChatArea のみ `flex: 1` + `overflow-y: auto` でスクロール。

### パネルの排他制御

| 状態               | SettingsPanel     | SessionListModal |
| ------------------ | ----------------- | ---------------- |
| 通常               | 閉                | 閉               |
| 設定開く           | 開                | 閉               |
| セッション一覧開く | 閉 (自動で閉じる) | 開               |
| 両方は開かない     | -                 | -                |

SessionListModal を開くと SettingsPanel は自動で閉じる。
SettingsPanel を開いても SessionListModal には影響しない (モーダルは既に閉じている)。

## コンポーネントツリー

```
App
├── Header (48px)
│   ├── [左グループ]
│   │   ├── SessionListButton (📋) → SessionListModal を開く
│   │   ├── NewSessionButton (+)
│   │   └── SessionTitle (クリックでインライン編集)
│   └── [右グループ]
│       ├── ModelSelector (モデル名, クリックでドロップダウン切替)
│       ├── ClearButton (🗑)
│       ├── ThemeToggle (🖥️/☀️/🌙, 3状態サイクル)
│       └── SettingsButton (⚙)
│
├── SessionListModal (モーダルダイアログ, Header のボタンで開閉)
│   ├── DeleteOldMenu (Menu: 7日/30日/90日/すべて + 確認ダイアログ)
│   ├── SearchInput (部分一致フィルタ)
│   ├── StatsBadges (セッション数, メッセージ数)
│   ├── SessionItem[] (タイトル, 日時, messages数, preview, 🔒/現在, 🗑)
│   └── EmptyState (0件時: アイコン + テキスト)
│
├── SettingsPanel (Collapse)
│   ├── ProviderSelect
│   ├── ModelSelect / ModelInput (プロバイダーで切替)
│   ├── ApiKeyInput (apikey方式のみ)
│   ├── BaseUrlInput (ローカルLLMのみ)
│   ├── OAuthSection (oauth方式のみ)
│   │   ├── OAuthLoginButton
│   │   ├── DeviceCodeDisplay (Copilot用)
│   │   └── ConnectionBadge
│   └── SaveButton / CloseButton
│
├── TabBar (28px)
│   └── TabTitle (タイトル — URL, truncate)
│
├── ChatArea (ScrollArea, flex:1)
│   ├── WelcomeScreen (user/assistantメッセージがない時のみ)
│   │   ├── Logo + Tagline
│   │   └── SamplePromptPill[] (staggered fade-in)
│   ├── LoadingState (セッション切替時)
│   ├── MessageBubble[] (role で分岐)
│   │   ├── ChatBubble (user/assistant)
│   │   │   ├── RoleIcon + RoleLabel
│   │   │   ├── MarkdownContent (ReactMarkdown + コピーボタン + 言語名)
│   │   │   ├── AttachedImage (user のみ)
│   │   │   └── ToolCallBlock[] (assistant のみ, 折りたたみ)
│   │   │       └── ToolHeader (name + description + status + chevron)
│   │   ├── NavigationBubble (navigation) — favicon + タイトル
│   │   ├── SystemMessage (system) — 中央揃え
│   │   └── ErrorMessage (error) — red, 設定リンク付き
│   ├── CompressionConfirm (クラウドプロバイダー時)
│   └── StreamingIndicator (dots + "考え中...")
│
└── InputArea
    ├── ElementCard (要素選択結果カード, 選択中のみ表示)
    ├── ActionButtons (📄 🎯 📸 + 📸添付済✕バッジ)
    ├── Textarea (autosize, 2-6行)
    └── SendButton (▶) / StopButton (⏹)  ← ストリーミング中切替
```

### Header のサイズ制約

サイドパネル幅 400px でのレイアウト:

```
[📋][+] セッション名(max120px)  model(max80px)▼ [🗑][🖥][⚙]
 30  30      120                     80              30 30 30
                                                   = 380px
```

SessionTitle の `maxWidth` を 120px に設定し、溢れは truncate。

## feature → コンポーネント対応

| feature              | コンポーネント                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/chat/`     | ChatArea, ChatBubble, NavigationBubble, SystemMessage, ErrorMessage, ToolCallBlock, MarkdownContent, InputArea, StreamingIndicator, WelcomeScreen |
| `features/settings/` | SettingsPanel, ProviderSelect, OAuthSection, DeviceCodeDisplay                                                                                    |
| `features/sessions/` | SessionListModal, SessionItem, SessionTitle, DeleteOldMenu                                                                                        |
| `sidepanel/`         | App, Header, TabBar, ThemeToggle, ModelSelector                                                                                                   |

## WelcomeScreen の表示条件

既存拡張 方式: `user` または `assistant` ロールのメッセージが存在するかで判定。
`system` メッセージだけでは WelcomeScreen は消えない。

```typescript
const hasConversation = messages.some((m) => m.role === "user" || m.role === "assistant");
if (!hasConversation) return <WelcomeScreen ... />;
```

## フォント

- 本文: system-ui (-apple-system, BlinkMacSystemFont, Segoe UI, Roboto)
- コード: SF Mono, Fira Code, monospace
- サイズ: xs=11px, sm=12px, md=13px (サイドパネル向け小さめ)

## アクセシビリティ

- キーボード: Ctrl+Enter 送信、ESC キャンセル/ピッカー閉じ
- Tooltip: 全アイコンボタンにラベル
- aria-label: アイコンボタンに設定
- コントラスト: WCAG AA (ダーク/ライト両方)
- テーマ: OS設定自動追従 (auto モード)

## アニメーション

| 対象                | アニメーション               | ライブラリ            |
| ------------------- | ---------------------------- | --------------------- |
| メッセージ追加      | fade-in + slide-up (150ms)   | Framer Motion         |
| 設定パネル開閉      | height transition (200ms)    | Mantine Collapse      |
| ストリーミング      | dots pulse (1s loop)         | CSS animation         |
| ToolCallBlock展開   | height transition (200ms)    | Mantine Collapse      |
| WelcomeScreen pills | staggered fade-in (0.1s間隔) | CSS animation         |
| テーマ切替          | color transition (0.3s ease) | CSS transition on `*` |

## 関連ドキュメント

- **[UIコンポーネント詳細設計](./ui-components-detail.md)** — 全コンポーネントのJSX、状態、インタラクション
- [機能仕様](./feature-spec.md) - ユーザーストーリーと画面構成
- [パッケージ構成](../architecture/package-structure.md) - feature → コンポーネント配置
- [状態管理設計](../architecture/state-management.md) - 各コンポーネントが参照するslice
