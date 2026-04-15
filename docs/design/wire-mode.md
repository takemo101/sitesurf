# Wire Mode — 外部エージェントからのブラウザ操作

## 概要

Wire Mode は、ローカルの AI エージェント（Claude Code, Copilot Coding Agent 等）から SiteSurf の Chrome 拡張経由で**現在開いているブラウザ**を操作する仕組み。

```
AI Agent (Claude Code等)
    │ stdio (MCP) or Skills or CLI
    ▼
sitesurf CLI (incur ベース)
    │ WebSocket (ws://localhost:7331)
    ▼
SiteSurf Chrome拡張 (background)
    │ chrome.tabs / chrome.scripting API
    ▼
現在開いているブラウザのページ
```

## 動機

- CDP (`--remote-debugging-port`) は新しいデバッグモードでブラウザを再起動する必要がある
- Wire Mode は**今開いているブラウザをそのまま操作**できる
- ログイン状態、Cookie、セッションがそのまま使える
- MCP / Skills / CLI の3つのインターフェースで接続可能

## 参考実装

- [chrome-lite-mcp](https://github.com/vutran1710/chrome-lite-mcp) — Chrome拡張 + MCP Server パターン
- [incur](https://github.com/wevm/incur) — CLI フレームワーク（MCP + Skills + CLI を統合）

## CLI フレームワーク: incur

[incur](https://github.com/wevm/incur) を使用する。

incur を選択した理由:

- `--mcp` フラグで自動的に MCP Server として動作
- `skills add` で AI エージェントに自動登録
- 人間もコマンドラインから直接使える
- TOON 出力でトークン効率 60% 改善
- `--token-limit` / `--token-offset` でページネーション
- Zod スキーマから型推論

## ユーザーの利用手順

```bash
# セットアップ（リポジトリ内で一回だけ）
cd sitesurf
npm install
npm link

# AI エージェントに登録
sitesurf mcp add     # MCP として登録
sitesurf skills add  # Skills として登録

# 人間が直接使う
sitesurf tabs-list
sitesurf page-read --tabId 123
sitesurf screenshot --tabId 123
```

AI エージェントの MCP 設定（`mcp add` で自動生成）:

```json
{
  "mcpServers": {
    "sitesurf": {
      "command": "sitesurf",
      "args": ["--mcp"]
    }
  }
}
```

## アーキテクチャ

### 構成要素

| コンポーネント       | 場所                         | 役割                                                 |
| -------------------- | ---------------------------- | ---------------------------------------------------- |
| **sitesurf CLI**     | `mcp-server/` (incur ベース) | CLI + MCP Server + Skills。WebSocket で拡張と通信    |
| **WebSocket Bridge** | background (拡張内)          | WebSocket クライアント。CLI からコマンドを受信・実行 |
| **ブラウザ操作**     | background → chrome API      | 既存の ChromeBrowserExecutor と同じ API を使用       |

### 通信フロー

```
1. sitesurf CLI 起動 → WebSocket Server を localhost:7331 で listen
2. Chrome拡張の background → ws://localhost:7331 に接続（自動再接続）
3. AI Agent → sitesurf CLI (stdio/MCP or CLI) → "page-read" コマンド
4. CLI → WebSocket → Chrome拡張 background
5. background → chrome.scripting.executeScript でページ内容取得
6. 結果を逆順で返す
```

### WebSocket プロトコル

CLI → 拡張:

```json
{ "id": "uuid", "method": "page_read", "params": { "tabId": 123, "mode": "text" } }
```

拡張 → CLI:

```json
{ "id": "uuid", "result": { "title": "...", "url": "...", "tree": {...} } }
```

エラー時:

```json
{ "id": "uuid", "error": "Element not found" }
```

## コマンド一覧

SiteSurf の既存ツールを incur コマンドとして公開する。

### タブ操作

| コマンド       | 説明                   | 引数            |
| -------------- | ---------------------- | --------------- |
| `tabs-list`    | 全タブ一覧             | —               |
| `tab-create`   | 新しいタブを作成       | `--url`         |
| `tab-navigate` | タブを URL に移動      | `<tabId> --url` |
| `tab-close`    | タブを閉じる           | `<tabId>`       |
| `tab-switch`   | タブをアクティブにする | `<tabId>`       |

### ページ操作

| コマンド             | 説明                     | 引数                               |
| -------------------- | ------------------------ | ---------------------------------- |
| `page-read`          | ページ内容を読み取り     | `--tabId --mode(text/interactive)` |
| `page-click`         | 要素をクリック           | `--tabId --selector` or `--x --y`  |
| `page-type`          | テキスト入力             | `--tabId --text --selector`        |
| `page-eval`          | JS 実行                  | `--tabId --code`                   |
| `screenshot`         | スクリーンショット       | `--tabId`                          |
| `page-pick-element`  | ページ上で要素を視覚選択 | `--tabId [--message]`              |
| `page-extract-image` | 画像/動画フレーム抽出    | `--tabId --selector [--maxWidth]`  |

> 方針: MCP/CLI はブラウザ操作と取得に限定し、`skill` / `artifacts` は公開しない。

## ディレクトリ構造

```
mcp-server/
├── cli.ts            # incur CLI 定義 (Cli.create + コマンド登録)
├── bridge.ts         # WebSocket Server → Chrome拡張への通信
├── commands/
│   ├── tabs.ts       # タブ操作コマンド群
│   └── page.ts       # ページ操作コマンド群
└── package.json      # incur, ws 依存
```

`package.json` (ルート) に `bin` を追加:

```json
{
  "bin": {
    "sitesurf": "./mcp-server/cli.ts"
  }
}
```

## 実装計画

### Phase 1: WebSocket Bridge (拡張側)

background に WebSocket クライアントを追加。

```typescript
// background/wire.ts
const WS_URL = "ws://localhost:7331";

function connectWire() {
  const ws = new WebSocket(WS_URL);
  ws.onmessage = async (event) => {
    const msg = JSON.parse(event.data);
    const result = await handleWireCommand(msg.method, msg.params);
    ws.send(JSON.stringify({ id: msg.id, result }));
  };
  ws.onclose = () => setTimeout(connectWire, 3000);
}
```

変更ファイル:

- `background/index.ts` — wire 接続の初期化
- `background/handlers/wire.ts` — コマンドハンドラー (新規)

### Phase 2: incur CLI + WebSocket Bridge (CLI 側)

```typescript
// mcp-server/cli.ts
import { Cli, z } from "incur";
import { ChromeBridge } from "./bridge";

const bridge = new ChromeBridge(7331);

Cli.create("sitesurf", { description: "Browser automation via SiteSurf extension" })
  .command("tabs-list", {
    description: "List all open tabs",
    async run() {
      return bridge.send("tabs_list");
    },
  })
  .command("page-read", {
    description: "Read page content",
    options: z.object({
      tabId: z.coerce.number().describe("Tab ID"),
      mode: z.enum(["text", "interactive"]).default("text"),
    }),
    async run(c) {
      return bridge.send("page_read", { tabId: c.options.tabId, mode: c.options.mode });
    },
  })
  .command("screenshot", {
    description: "Capture screenshot",
    options: z.object({
      tabId: z.coerce.number().describe("Tab ID"),
    }),
    async run(c) {
      return bridge.send("page_screenshot", { tabId: c.options.tabId });
    },
  })
  .serve();
```

### Phase 3: Service Worker の Keep-Alive

Chrome MV3 の Service Worker は 30 秒で suspend される。
`chrome.alarms` で定期的に ping を送り WebSocket 接続を維持する。

```typescript
chrome.alarms.create("keep-alive", { periodInMinutes: 25 / 60 });
chrome.alarms.onAlarm.addListener(() => {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ id: "ping", method: "ping" }));
  }
});
```

## 実現可能性の検証

### ✅ 確実に可能

| 項目                                | 理由                                                   |
| ----------------------------------- | ------------------------------------------------------ |
| WebSocket クライアント (background) | MV3 の Service Worker で `new WebSocket()` は使用可能  |
| chrome.tabs / chrome.scripting      | 既存の SiteSurf で使用済み                             |
| incur CLI + MCP                     | incur の `--mcp` フラグで標準 MCP Server 化            |
| incur Skills                        | `skills add` で AI エージェントに自動登録              |
| localhost 通信                      | Chrome 拡張の CSP で `ws://localhost` は許可           |
| `npm link`                          | ローカルリポジトリからグローバルコマンドとして登録可能 |

### ⚠️ 注意点

| 項目                      | 対策                                                   |
| ------------------------- | ------------------------------------------------------ |
| Service Worker の suspend | `chrome.alarms` で 25 秒ごとに ping + 自動再接続       |
| WebSocket 切断            | 3 秒間隔で自動再接続。CLI 側は接続待ちタイムアウト付き |
| CSP                       | manifest の `connect-src ws://localhost:*` を追加      |
| セキュリティ              | localhost のみ。外部からのアクセスは不可               |

### ❌ 不可能 / 非推奨

| 項目                                    | 理由                                            |
| --------------------------------------- | ----------------------------------------------- |
| background で WebSocket Server を立てる | Service Worker では不可。Server は CLI 側に置く |
| `User-Agent` の偽装                     | ブラウザの fetch の制約。Wire Mode でも回避不可 |

## manifest.json の変更

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'; connect-src ws://localhost:*"
  },
  "permissions": [..., "alarms"]
}
```

## 既存コードとの関係

Wire Mode は既存の SiteSurf の機能と**独立して動作**する。

```
┌─ SiteSurf Chrome拡張 ─────────────────┐
│                                          │
│  sidepanel (既存)     background         │
│  ├─ AI チャット       ├─ Port (セッション) │
│  ├─ ツール実行        ├─ Wire (WebSocket) │ ← 新規
│  └─ 設定              └─ alarms          │
│                                          │
└──────────────────────────────────────────┘

┌─ sitesurf CLI (incur) ─────────────────┐
│  ├─ WebSocket Server (bridge)            │
│  ├─ MCP Server (--mcp)                   │
│  ├─ Skills (skills add)                  │
│  └─ CLI コマンド (人間用)                │
└──────────────────────────────────────────┘
```

Wire Mode の handler は background 側で chrome API を直接呼ぶため、
`ChromeBrowserExecutor` とコードを共有しつつ独立して動作する。

## incur vs `@modelcontextprotocol/sdk` 直接

| 観点             | incur                              | MCP SDK 直接   |
| ---------------- | ---------------------------------- | -------------- |
| MCP 対応         | `--mcp` フラグで自動               | 手動実装       |
| Skills 対応      | `skills add` で自動登録            | なし           |
| 人間が直接使える | CLI として実行可能                 | MCP 専用       |
| トークン効率     | TOON 出力で 60% 削減               | JSON のみ      |
| セットアップ     | `sitesurf mcp add`                 | MCP 設定手書き |
| ページネーション | `--token-limit` / `--token-offset` | なし           |
