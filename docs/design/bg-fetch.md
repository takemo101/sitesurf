# bg_fetch ツール設計

## 概要

独立したAI toolとして `bg_fetch` を追加し、background service worker経由でCORS制限を回避して任意URLのコンテンツを取得する。複数URLの一括並列取得と、HTMLページからの本文+リンク抽出（Readability）に対応する。

REPL 内からは同名のヘルパ `bgFetch(url, options?)` として再エクスポートされ、ループで複数URLを取得した結果を **AI コンテキストに載せず** `saveArtifact` に直接保存できる。

**GitHub Issue**: #7

## 設定トグル: `enableBgFetch`

設定 → システム → 「バックグラウンドフェッチを有効にする」で ON/OFF できる。**デフォルトは OFF**（PR #56 の MCP 削除と同タイミングで導入された保守的デフォルト）。

| 設定値                | 上位 `bg_fetch` ツール                    | REPL `bgFetch()` ヘルパ                                                                                                      |
| --------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `enableBgFetch=true`  | ツール一覧に登録され description も完全形 | sandbox に注入され、`<!-- BG_FETCH_SECTION_START/END -->` で囲まれた説明が REPL description に残る                           |
| `enableBgFetch=false` | ツール定義から除外（AI から不可視）       | `FetchProvider.handleRequest` が `bgFetch is disabled in settings` で拒否、REPL description からも該当セクションが除去される |

OFF 時に AI へ偶発的に bgFetch を案内しないため、**system prompt / REPL description / ツール一覧の三箇所すべてから記述を消す**ように `stripBgFetchSections` と `getAgentToolDefs` で集中管理している（PR #73, #74）。

## アーキテクチャ

### 通信フロー

```
AI → tool call: bg_fetch({ urls: [...], response_type: "readability" })
  → agent-loop: executeToolCall()
  → createToolExecutorWithSkills: case "bg_fetch"
  → executeBgFetch(args)
  → chrome.runtime.sendMessage<BgFetchMessage, BgFetchResponse>(...)
  → background/handlers/bg-fetch.ts: fetchOneWithBgInfra()
  → fetch(url)  ※CORS回避（host_permissions: <all_urls>）
  → (readability時) chrome.runtime.sendMessage → offscreen/index.ts
  → レスポンスを返却

REPL 内からは同じ background インフラを FetchProvider 経由で利用する：
AI → tool call: repl({ code: "await bgFetch(url, { responseType: 'readability' })" })
  → sandbox.html の bgFetch() → postMessage
  → repl.ts handleSandboxRequest → FetchProvider.handleRequest
  → chrome.runtime.sendMessage<BgFetchMessage, BgFetchResponse>(...)
  → background/handlers/bg-fetch.ts: fetchOneWithBgInfra() （同じ関数）
```

### 設計判断: 独立tool vs REPL sandbox関数

| 比較項目   | 独立tool（採用）                     | REPL sandbox関数                      |
| ---------- | ------------------------------------ | ------------------------------------- |
| 結果の扱い | AIコンテキストに直接入る             | REPL出力として返る                    |
| 並列取得   | `urls: string[]` で1 tool callで実現 | `Promise.all` をAIが書く必要あり      |
| 変更範囲   | sandbox.html, repl.ts 変更不要       | sandbox.html, RuntimeProvider変更必要 |
| 統一感     | `read_page`, `navigate` と同列       | REPL内の関数として異質                |

## API仕様

### Tool Definition

```typescript
export const bgFetchToolDef: ToolDefinition = {
  name: "bg_fetch",
  description:
    "外部URLのコンテンツを取得する。CORSを回避してあらゆるURLにアクセス可能。" +
    "複数URLを並列取得できる。Webページはresponse_type='readability'で本文のみ抽出すると効率的。",
  parameters: {
    type: "object",
    properties: {
      urls: {
        type: "array",
        items: { type: "string" },
        description: "取得するURLのリスト",
      },
      method: {
        type: "string",
        description: "HTTPメソッド（default: GET）",
      },
      headers: {
        type: "object",
        description: "リクエストヘッダー",
      },
      body: {
        type: "string",
        description: "リクエストボディ",
      },
      response_type: {
        type: "string",
        enum: ["text", "json", "base64", "readability"],
        description: "レスポンス形式",
      },
      timeout: {
        type: "number",
        description: "タイムアウトms（default: 30000, max: 60000）",
      },
    },
    required: ["urls"],
  },
};
```

### 戻り値

```typescript
interface BgFetchResultItem {
  url: string;
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string | object; // responseTypeに応じた型
  redirected?: boolean;
  redirectUrl?: string;
  error?: string;
}

// readability時の body
interface ReadabilityBody {
  title: string; // ページタイトル
  content: string; // 本文テキスト（ナビ/広告/サイドバー除去済み）
  links: Array<{
    // 本文内のリンク一覧（ドキュメント探索用）
    text: string;
    href: string; // 絶対URL（相対パス自動解決）
  }>;
}
```

- `urls.length === 1` → `BgFetchResultItem` を直接返す
- `urls.length > 1` → `BgFetchResultItem[]` を返す

### responseType 別の body 型

| responseType     | body の型         | 用途                                     |
| ---------------- | ----------------- | ---------------------------------------- |
| `text` (default) | `string`          | GitHub raw files, ソースコード, テキスト |
| `json`           | `object`          | JSON API レスポンス                      |
| `base64`         | `string`          | 画像等バイナリ                           |
| `readability`    | `ReadabilityBody` | Webページ（本文抽出+リンク探索）         |

## セキュリティ仕様

### URLバリデーション

| チェック項目 | 制限                                                                             |
| ------------ | -------------------------------------------------------------------------------- |
| プロトコル   | `chrome://`, `chrome-extension://`, `file://`, `data:`, `javascript:` をブロック |
| ホスト       | `localhost`, `127.0.0.1`, `::1`, `0.0.0.0`, `[::1]` をブロック                   |
| URL長        | 2000文字上限                                                                     |
| 認証情報     | `user:pass@host` 禁止                                                            |
| HTTP昇格     | `http://` → `https://` 自動昇格                                                  |

### リクエスト制御

| 項目               | 制限                                              |
| ------------------ | ------------------------------------------------- |
| タイムアウト       | デフォルト30秒、最大60秒                          |
| レスポンスサイズ   | 5MB（1リクエストあたり）                          |
| 同時リクエスト     | 最大10（セマフォ制御）                            |
| URL数/tool call    | 最大20                                            |
| リダイレクト       | 同一ホスト（www有無のみ）自動追従、別ホストは通知 |
| リダイレクトホップ | 最大10回                                          |
| 出力文字数         | 1レスポンスあたり50K文字で切り詰め                |

### キャッシュ

- GETリクエストのみキャッシュ
- TTL: 5分
- 最大100エントリ
- background service worker のインメモリ（SW再起動でクリア）

## Offscreen Document（Readability用）

### なぜ必要か

background service workerにはDOMがないため、`DOMParser` や `@mozilla/readability` を実行できない。Chrome MV3の `chrome.offscreen` APIでDOM環境を一時的に作成する。

### ライフサイクル

- `chrome.offscreen.hasDocument()` で毎回チェック、なければ `createDocument`
- 常駐させる（並列readabilityリクエストに対応するため）
- Chromeが自動停止した場合は次回リクエスト時に再作成
- 1拡張につき1 offscreen documentの制約あり → 将来機能は同じHTMLにハンドラー追加

### 処理フロー

```
bg-fetch.ts: extractWithReadability(html, url)
  → chrome.offscreen.hasDocument() → なければ createDocument
  → chrome.runtime.sendMessage({ type: "BG_READABILITY", html, url })
  → offscreen/index.ts:
      → DOMParser.parseFromString(html, "text/html")
      → Readability(doc).parse() → 本文テキスト抽出
      → extractLinks(contentRoot, url) → 本文内リンク抽出
      → フォールバック: main > article > [role="main"] > body
  → { title, content, links } を返却
```

### リンク抽出

- 本文領域（`main`, `article`, `[role="main"]`）内の `<a>` タグのみ対象
- ナビゲーション、フッター、サイドバーのリンクは除外
- 相対URLは `<base>` 要素で絶対URLに解決
- 重複URL、`javascript:` リンクは除外

## メッセージプロトコル

### BgFetch メッセージ

```typescript
// sidepanel → background
interface BgFetchMessage {
  type: "BG_FETCH";
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  responseType: "text" | "json" | "base64" | "readability";
  timeout: number;
}

interface BgFetchResponse {
  success: boolean;
  data?: {
    url: string;
    ok: boolean;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string | object;
    redirected?: boolean;
    redirectUrl?: string;
  };
  error?: string;
}
```

### Readability メッセージ

```typescript
// background → offscreen
interface ReadabilityMessage {
  type: "BG_READABILITY";
  html: string;
  url: string;
}

interface ReadabilityResponse {
  success: boolean;
  title?: string;
  content?: string;
  links?: Array<{ text: string; href: string }>;
  error?: string;
}
```

## ユースケース

### リポジトリ探索

```javascript
// 1. ファイル一覧取得
bg_fetch({ urls: ["https://api.github.com/repos/owner/repo/contents/src"], response_type: "json" });

// 2. 複数ソースファイルを並列取得
bg_fetch({
  urls: [
    "https://raw.githubusercontent.com/.../index.ts",
    "https://raw.githubusercontent.com/.../utils.ts",
    "https://raw.githubusercontent.com/.../types.ts",
  ],
  response_type: "text",
});
```

### ドキュメント探索（リンク辿り）

```javascript
// 1. トップページ取得 → リンク一覧を把握
bg_fetch({ urls: ["https://docs.example.com/api/"], response_type: "readability" })
// → body.content: "API概要..."
// → body.links: [{ text: "認証", href: "https://..." }, ...]

// 2. リンクから関連ページを並列取得
bg_fetch({ urls: [body.links から選んだURL], response_type: "readability" })
```

### JSON API

```javascript
bg_fetch({ urls: ["https://api.example.com/data"], response_type: "json" });
```

## 実装箇所

| ファイル                              | 変更種別 | 内容                                                                                 |
| ------------------------------------- | -------- | ------------------------------------------------------------------------------------ |
| `src/shared/message-types.ts`         | 変更     | BgFetch/Readability メッセージ型                                                     |
| `src/background/handlers/bg-fetch.ts` | **新規** | fetchハンドラー（バリデーション、セマフォ、キャッシュ、リダイレクト、offscreen連携） |
| `src/background/index.ts`             | 変更     | bg-fetchハンドラー import                                                            |
| `src/offscreen/index.ts`              | **新規** | Readability本文抽出 + リンク抽出                                                     |
| `public/offscreen.html`               | **新規** | offscreen document                                                                   |
| `src/features/tools/bg-fetch.ts`      | **新規** | ToolDefinition + executeBgFetch                                                      |
| `src/features/tools/index.ts`         | 変更     | tool登録                                                                             |
| `public/manifest.json`                | 変更     | `"offscreen"` permission追加                                                         |
| `vite.config.ts`                      | 変更     | offscreenエントリポイント、chunk、HTMLコピー                                         |
| `package.json`                        | 変更     | `@mozilla/readability` 依存追加                                                      |

## 関連ドキュメント

- [ツール設計](../architecture/tools.md) - ツールアーキテクチャ全体
- [manifest パーミッション](./manifest-permissions.md) - offscreen パーミッション
- [ネイティブ入力イベント](./native-input-events.md) - 同じ background 通信パターン
- [サンドボックス実装](./sandbox-implementation.md) - sandbox.html（bg_fetchでは不使用）
