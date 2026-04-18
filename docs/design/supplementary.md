# 補足設計: ヘルパー・定数・ライフサイクル・モデル切替

## 概要

各詳細設計ドキュメントで参照されているが、配置場所や実装が未定義だったヘルパー関数、
定数定義、Chrome拡張ライフサイクル、チャット中のモデル切替を定める。

## A1: チャット中のモデル切替

### 要件

セッション途中でAIモデルを切り替えられる。既存拡張 方式。

### UI

Header の ModelLabel をクリック可能にし、ドロップダウンでモデルを選択する。

```
┌───────────────────────────────────────────┐
│ [📋][+] タイトル     anthropic ▼ [🗑][🖥][⚙]│
└──────────────────────────┬────────────────┘
                           │ クリック
                           ▼
                    ┌──────────────┐
                    │ claude-sonnet│ ← 現在
                    │ claude-opus  │
                    │ claude-haiku │
                    ├──────────────┤
                    │ カスタム入力  │ ← TextInput
                    └──────────────┘
```

```tsx
function ModelSelector() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const isStreaming = useStore((s) => s.isStreaming);
  const provider = PROVIDERS[settings.provider];

  return (
    <Menu disabled={isStreaming}>
      <Menu.Target>
        <UnstyledButton px={4} py={2} style={{ borderRadius: 4 }} className="hover-highlight">
          <Text size="10px" c="dimmed" truncate maw={80}>
            {settings.model || provider.defaultModel}
          </Text>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        {provider.models.map((m) => (
          <Menu.Item
            key={m}
            onClick={() => setSettings({ model: m })}
            rightSection={
              m === (settings.model || provider.defaultModel) ? <Check size={12} /> : null
            }
          >
            {m}
          </Menu.Item>
        ))}
        {settings.provider === "local" && (
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
```

### 振る舞い

- ストリーミング中はモデル切替を無効化 (Menu disabled)
- モデル変更は `SettingsSlice.model` を更新するだけ
- 次の `runAgentLoop` 呼出し時に `resolveAIProvider` が新しいモデルで AIProvider を生成
- セッション内でモデルを変えた場合、`Session.model` は最後に使ったモデルで保存される
- 設定パネルの保存ボタンを押さなくても即座に反映される (設定パネルの保存はストレージ永続化)

### A2: インラインAPIキー設定

v0.1 では対応しない。エラーメッセージ + 「設定を開く」ボタンで対応。
feature-spec.md の F-01 エラー状態、ui-components-detail.md の ErrorMessage で設計済み。

## B: ヘルパー関数・定数の配置

### shared/utils.ts

```typescript
// shared/utils.ts

/** 指定ミリ秒待機する */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** ISO 8601 の日時を相対表示に変換 */
export function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}日前`;
  if (days < 30) return `${Math.floor(days / 7)}週間前`;
  return new Date(iso).toLocaleDateString("ja-JP");
}

/** ISO 8601 の日時が指定日数以上前かを判定 */
export function isOlderThan(iso: string, days: number): boolean {
  return Date.now() - new Date(iso).getTime() > days * 24 * 60 * 60 * 1000;
}
```

### shared/constants.ts

```typescript
// shared/constants.ts

export type ProviderId = "anthropic" | "openai" | "google" | "copilot" | "local";

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  defaultModel: string;
  models: string[];
  authType: "apikey" | "oauth" | "none";
  placeholder?: string;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  anthropic: {
    id: "anthropic",
    name: "Anthropic (Claude)",
    defaultModel: "claude-sonnet-4-20250514",
    models: ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-3-5-haiku-20241022"],
    authType: "apikey",
    placeholder: "sk-ant-...",
  },
  openai: {
    id: "openai",
    name: "OpenAI (ChatGPT)",
    defaultModel: "gpt-4o",
    models: ["gpt-4o", "gpt-4o-mini", "o3-mini"],
    authType: "oauth",
    placeholder: "sk-...",
  },
  google: {
    id: "google",
    name: "Google (Gemini)",
    defaultModel: "gemini-2.5-flash",
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
    authType: "apikey",
    placeholder: "AIza...",
  },
  copilot: {
    id: "copilot",
    name: "GitHub Copilot",
    defaultModel: "gpt-4o",
    models: ["gpt-4o", "claude-sonnet-4-20250514", "o3-mini"],
    authType: "oauth",
  },
  local: {
    id: "local",
    name: "ローカルLLM (Ollama等)",
    defaultModel: "llama3.2",
    models: [],
    authType: "none",
    placeholder: "http://localhost:11434",
  },
};
```

### features/chat/sample-prompts.ts

```typescript
// features/chat/sample-prompts.ts

export const SAMPLE_PROMPTS = [
  {
    label: "📄 このページの内容を要約して",
    prompt: "現在のページの内容を読み取って、要約を教えてください。",
  },
  {
    label: "🔍 ページ内のリンクを一覧にして",
    prompt: "このページにあるすべてのリンクを一覧にしてください。URLとリンクテキストを含めて。",
  },
  {
    label: "📝 フォームに情報を入力して",
    prompt: "このページのフォームの構造を確認して、入力欄の一覧を教えてください。",
  },
  {
    label: "🛒 商品の価格情報を抽出して",
    prompt: "このページに掲載されている商品の名前と価格を一覧にしてください。",
  },
];
```

### OAuth ヘルパー (adapters/auth/ 内 private)

`extractAccountId`, `generatePKCE`, `generateState`, `buildAuthUrl` は
`adapters/auth/openai-auth.ts` 内の private 関数として配置する。
外部からインポートする必要がないため `shared/` には置かない。

```typescript
// adapters/auth/openai-auth.ts 内

function extractAccountId(accessToken: string): string | undefined {
  try {
    const payload = JSON.parse(atob(accessToken.split(".")[1]));
    const auth = payload["https://api.openai.com/auth"];
    return auth?.chatgpt_account_id;
  } catch {
    return undefined;
  }
}

async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const verifier = base64urlEncode(bytes);
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return { verifier, challenge: base64urlEncode(new Uint8Array(hash)) };
}

function generateState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64urlEncode(bytes);
}

function base64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function buildAuthUrl(challenge: string, state: string): URL {
  const url = new URL("https://auth.openai.com/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", "openid profile email offline_access");
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  url.searchParams.set("codex_cli_simplified_flow", "true");
  return url;
}
```

## C: Chrome拡張ライフサイクル

### C1: chrome.runtime.onInstalled

Background Service Worker で処理する。

```typescript
// background/index.ts に追加

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // 初回インストール
    console.log("[Background] Sitesurf installed");
    // サイドパネルを自動で開くことはできない (ユーザー操作が必要)
    // 特別な初期化処理は不要 (サイドパネル起動時に boot-sequence が処理)
  }

  if (details.reason === "update") {
    // 拡張更新
    console.log("[Background] Sitesurf updated to", chrome.runtime.getManifest().version);
    // IndexedDB マイグレーションはサイドパネル起動時に onupgradeneeded で自動実行
    // Background での追加処理は不要
  }
});
```

### C2: chrome.runtime.onSuspend

```typescript
// background/index.ts に追加

chrome.runtime.onSuspend.addListener(() => {
  console.log("[Background] Service Worker suspending");
  // 現設計では Background に長期状態がない (ロックは chrome.storage.session に保存済み)
  // 追加のクリーンアップ不要
});
```

### C3: 拡張更新時のサイドパネル

サイドパネルを開いたまま拡張が更新された場合、古い JS が残る。
Chrome は拡張更新時にサイドパネルを自動リロードする場合としない場合がある。

**v0.1 方針: 特別な対応はしない。**

- 更新後にサイドパネルを閉じて再度開けば新バージョンが読み込まれる
- IndexedDB のスキーマ変更は onupgradeneeded で自動マイグレーション
- 深刻な非互換が発生した場合は v0.2 で `chrome.runtime.onInstalled` から通知バナーを表示する対応を検討

### まとめ: Background の完全なイベントリスナー

```typescript
// background/index.ts (最終形)

// --- メッセージルーティング ---
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => { ... });

// --- パネル接続管理 (セッションロック) ---
chrome.runtime.onConnect.addListener((port) => { ... });

// --- アイコンクリック ---
chrome.action.onClicked.addListener((tab) => { ... });

// --- キーボードショートカット ---
chrome.commands.onCommand.addListener((command, tab) => { ... });

// --- ライフサイクル ---
chrome.runtime.onInstalled.addListener((details) => { ... });
chrome.runtime.onSuspend.addListener(() => { ... });

// --- ウィンドウ閉じ (ロック解放のバックアップ) ---
chrome.windows.onRemoved.addListener((windowId) => {
  releaseLocksForWindow(windowId);
});
```

## D: 注記事項

### D1: IndexedDB onblocked

v0.1 では DB_VERSION = 1 のみなので発生しない。
v0.2 でスキーマ変更する際は `indexeddb-migration.md` に従い、
`onblocked` ハンドラを追加する:

```typescript
req.onblocked = () => {
  console.warn("[IndexedDB] Database blocked. Close other tabs.");
  // ユーザーに「他のタブを閉じてください」と通知
};
```

### D2: message-transformer (メッセージ並べ替え)

既存拡張 では `browserMessageTransformer` でツール結果とナビゲーションメッセージの
順序を整理している。Sitesurf の agent-loop はローカル `messages` 配列で管理するため、
メッセージの順序は挿入順で保証される。並べ替えは不要。

ただし、ストリーミング中にタブ変更が発生した場合のナビゲーションメッセージ挿入位置は
`agent-loop-detail.md` で設計済み (次の streamText 呼出し時に含める)。

## パッケージ構成への影響

```
src/shared/
├── message-types.ts    # (既存)
├── errors.ts           # (既存)
├── constants.ts        # [詳細確定] ProviderId, PROVIDERS
└── utils.ts            # [新規] sleep, formatRelativeDate, isOlderThan

src/features/chat/
├── sample-prompts.ts   # [新規] SAMPLE_PROMPTS
└── system-prompt.ts    # (既存, system-prompt.md で設計済み)
```

## 関連ドキュメント

- [機能仕様](./feature-spec.md) - F-09 ウェルカム、v0.1 スコープ
- [UI/UX設計](./ui-ux-design.md) - コンポーネントツリー
- [UIコンポーネント詳細](./ui-components-detail.md) - ModelSelector の配置
- [起動シーケンス](./boot-sequence.md) - Background のイベントリスナー
- [パッケージ構成](../architecture/package-structure.md) - shared/ の構成
