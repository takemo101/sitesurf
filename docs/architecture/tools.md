# ツール設計

## 設計方針

**ツールの「定義」は `features/tools/` に、ページ操作の「実行」は `ports/browser-executor`
で抽象化し、Side Panel→Background の通信は `adapters/chrome/` に閉じ込める。**

## Port定義

### BrowserExecutor (統合Port)

ページ操作とタブ操作を1つのPortに統合する。
メソッドはツールと1:1に対応せず、ブラウザが提供する能力を表す。

```typescript
// ports/browser-executor.ts

export interface BrowserExecutor {
  // --- タブ操作 ---
  getActiveTab(): Promise<TabInfo>;
  openTab(url: string): Promise<number>;
  navigateTo(tabId: number, url: string): Promise<Result<NavigationResult, BrowserError>>;
  captureScreenshot(): Promise<string>; // data URL
  onTabActivated(callback: (tabId: number) => void): Unsubscribe;
  onTabUpdated(callback: (tabId: number, url: string) => void): Unsubscribe;
  onTabRemoved(callback: (tabId: number) => void): Unsubscribe;

  // --- ページ操作 (対象タブのDOMに対する操作) ---
  readPageContent(tabId: number, maxDepth?: number): Promise<Result<PageContent, BrowserError>>;
  executeScript(tabId: number, code: string): Promise<Result<ScriptResult, ToolError>>;
  injectElementPicker(
    tabId: number,
    message?: string,
  ): Promise<Result<ElementInfo | null, BrowserError>>;
}

type Unsubscribe = () => void;
```

### なぜ ToolExecutor を廃止し BrowserExecutor に統合したか

旧設計の `ToolExecutor` はツールごとにメソッドを持っていたため:

- ツール追加のたびにPortのinterfaceを変更する必要があった (OCP違反)
- `BrowserPort` との責務境界が曖昧だった (screenshotはどっち？)

新設計では:

- `BrowserExecutor` はブラウザの「能力」を列挙する (タブ操作 + ページ操作)
- ツール定義 (`features/tools/`) が能力を組み合わせてツールを構成する
- ツール追加時はPortを変更せず、既存の能力を組み合わせるだけで済む

### ツール定義 → BrowserExecutor 能力のマッピング

| ツール         | 使用する BrowserExecutor メソッド                               |
| -------------- | --------------------------------------------------------------- |
| `read_page`    | `getActiveTab()` + `readPageContent()`                          |
| `repl`         | `getActiveTab()` + `executeScript()` + `navigateTo()`           |
| `pick_element` | `getActiveTab()` + `injectElementPicker()`                      |
| `screenshot`   | `captureScreenshot()`                                           |
| `skill`        | ストレージ操作（SkillRegistry経由）                             |
| `bg_fetch`     | 不使用（`chrome.runtime.sendMessage` で background に直接通信） |

新ツール `click_element` を追加する場合:

- `executeScript(tabId, "document.querySelector(sel).click()")` で実現可能
- **Portの変更不要**

## adapters/chrome/ と background/ の関係

### 物理的な通信の流れ

ツール実行は Side Panel から Chrome API を直接呼び出す。Background は関与しない。

```
Side Panel
───────────────────────────────────────────
adapters/chrome/
  chrome-browser-executor.ts
    │
    │ chrome.scripting.executeScript()    ページのJSを実行
    │ ──────────────────────────────────→ 対象ページ (コンテンツ)
    │
    │ chrome.userScripts.execute()        USER_SCRIPT world で実行 (利用可能時)
    │ ──────────────────────────────────→ 対象ページ (コンテンツ)
    │
    │ chrome.tabs.update() + webNavigation.onDOMContentLoaded
    │ ──────────────────────────────────→ ナビゲーション完了待ち
    │
    │ chrome.tabs.captureVisibleTab()     スクリーンショット
    └─────────────────────────────────→

Side Panel                              Background Service Worker
─────────────                           ─────────────────────────
shared/port.ts                          background/index.ts
  chrome.runtime.connect()               Port 接続受付
    │ Port (長接続)                        │
    │ acquireLock ──────────────────────→  │→ handlers/session-lock.ts
    │ ←────────────────────── lockResult  │
    │ getLockedSessions ────────────────→  │→ chrome.storage.session
    │ ←──────────────────── lockedSessions │
```

### 責務の分離

| モジュール                                   | 責務                                                       | 依存                     |
| -------------------------------------------- | ---------------------------------------------------------- | ------------------------ |
| `adapters/chrome/chrome-browser-executor.ts` | Chrome API 直接呼び出し。BrowserExecutor Port を実装       | `ports/browser-executor` |
| `shared/port.ts`                             | Port (長接続) の確立とメッセージ送受信                     | 誰にも依存しない         |
| `background/index.ts`                        | Port 接続受付。セッションロックとパネル追跡のみ処理        | `shared/port` (型契約)   |
| `background/handlers/session-lock.ts`        | chrome.storage.session を使ったセッション排他ロック        | Chrome API のみ          |
| `background/handlers/panel-tracker.ts`       | サイドパネルの開閉状態追跡                                 | Chrome API のみ          |
| `background/handlers/native-input.ts`        | Native Input Functions（デバッガー経由）                   | Chrome API のみ          |
| `background/handlers/bg-fetch.ts`            | bg_fetch（URLバリデーション、fetch、セマフォ、キャッシュ） | Chrome API + offscreen   |

**ツール実行はすべて Side Panel から直接 Chrome API を呼び出す。**
Background は以下に特化:

- セッションロック管理
- パネル追跡
- Native Input Functions（デバッガーAPI使用）

## ツール定義

`features/tools/` は Vercel AI SDK の `tool()` ヘルパーで定義する。
各ツールは `BrowserExecutor` のメソッドを組み合わせる。

```typescript
// features/tools/read-page.ts
import type { ToolDefinition } from "@/ports/ai-provider";
import type { BrowserExecutor } from "@/ports/browser-executor";

/**
 * ツール定義は Port の ToolDefinition (JSON Schema) を返す。
 * execute 関数は含まない — 実行は orchestration/agent-loop が担当。
 */
export const readPageToolDef: ToolDefinition = {
  name: "read_page",
  description: "現在のページのテキストとDOM構造を取得する",
  parameters: { type: "object", properties: {}, required: [] },
};

/**
 * ツールの実行ロジック。agent-loop の executeTool から呼ばれる。
 */
export async function executeReadPage(browser: BrowserExecutor) {
  const tab = await browser.getActiveTab();
  if (!tab.id) return err({ code: "tool_tab_not_found", message: "アクティブなタブがありません" });
  return browser.readPageContent(tab.id);
}
```

**ツール定義 (`ToolDefinition`) と実行ロジックを分離する。**

- `ToolDefinition` は AI に渡すスキーマのみ (execute を含まない)
- 実行ロジックは export された関数として提供し、agent-loop が呼ぶ
- features/tools/ は adapters/ に依存しない
- テスト時にモック BrowserExecutor を渡せる

### skill ツール

`skill` ツールはサイト固有または global の JavaScript ライブラリ（Skill）を管理する。

```typescript
// features/tools/skill.ts

export const skillToolDef: ToolDefinition = {
  name: "skill",
  description: `サイト固有の自動化ライブラリを管理する。

## アクション

**list** - 利用可能なスキルを一覧
- { action: "list" } - 現在のタブURLにマッチするスキル
- { action: "list", url: "https://example.com" } - 特定URLにマッチするスキル
- { action: "list", url: "" } - すべてのスキル

**get** - スキル詳細を取得
- { action: "get", id: "youtube" }
- { action: "get", id: "youtube", includeLibraryCode: true } - ライブラリコード含む

**create** - 新規スキル作成
- { action: "create", data: Skill }

**update** - スキル更新（部分更新）
- { action: "update", id: "skill-name", updates: Partial<Skill> }

**patch** - スキルパッチ（文字列置換）
- { action: "patch", id: "skill-name", patches: { field: { old_string, new_string } } }

**delete** - スキル削除
- { action: "delete", id: "skill-name" }

## Skill型

{
  id: string;                    // 一意識別子
  name: string;                  // 表示名
  description: string;           // 詳細説明（マークダウン）
  scope?: "site" | "global";   // site は URL マッチ必須、global は全サイト対象
  matchers: {
    hosts: string[];             // ホスト名（["youtube.com", "youtu.be"]）
    paths?: string[];            // パスプレフィックス（オプション）
    signals?: string[];          // ページ内シグナル（オプション）
  };
  extractors: Array<{
      id: string;                  // 抽出関数名
      name: string;                // 表示名
      description: string;         // 機能説明
      selector?: string;           // 補助セレクター（オプション）
      code: string;                // JavaScript関数コード
      outputSchema: string;        // 出力スキーマ
    }>;
}`,
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["list", "get", "create", "update", "patch", "delete"],
      },
      // ... actionごとのパラメータ
    },
    required: ["action"],
  },
};
```

Skillは以下のタイミングでrepl sandboxに自動注入される:

1. ユーザーがページを開く
2. `SkillRegistry.findMatchingSkills(url)` でマッチングスキルを検索
3. マッチングスキルがsandboxに渡される
4. sandbox内で `window.skillId.extractorId()` として使用可能

### create_skill_draft ツール

`create_skill_draft` はチャット起点で Skill の下書きを保存する専用ツール。`skill.create` と違って custom skill には即反映せず、Settings の承認ゲートを必ず通す。

- 入力: `name`, `description`, `scope`, `matchers`, `extractors`
- 出力: `draftId`, `normalizedSkill`, `validation`, `suggestedFixes`
- 永続化先: `sitesurf_skill_drafts`
- 承認前の状態では `SkillRegistry` に登録されず、repl sandbox にも注入されない

validation は 3 段階で返す:

- `ok`: そのまま承認可能
- `warning`: 承認は可能だが説明不足や output schema の粗さを通知
- `reject`: 危険コード・重複 ID などにより承認不可

Settings 側では下書き一覧を表示し、ユーザーが `承認保存` を押したときだけ custom skill ストアへ移動する。`破棄` を押した場合は draft ストアからのみ削除する。

### repl ツールのパターン

`repl` は sandbox iframe 経由でコードを評価し、複数のヘルパーをAIに公開する。

```typescript
// features/tools/repl.ts (概略)

export const replToolDef: ToolDefinition = {
  name: "repl",
  description: `JavaScript REPL — ブラウザ操作の中心ツール。

## 利用可能な関数

**browserjs(fn, ...args)** - ページコンテキストでJSを実行
- 関数はシリアライズされてページに注入される
- データは引数で渡す（JSONシリアライズ可能な値のみ）
- クロージャは使えない

**navigate(url)** - URLに移動して読み込み完了を待つ
- window.location は使わない

**skills** - マッチングスキルが自動的に利用可能
- skill({ action: 'list' }) で確認
- browserjs内で window.skillId.extractorId() で使用

**Artifact Functions** - データ永続化
- createOrUpdateArtifact(name, data)
- getArtifact(name)
- listArtifacts()
- deleteArtifact(name)

**File Functions** - ファイル返却
- returnFile(name, content, mimeType)

**Native Input Functions** - 実際のブラウザイベント（bot対策サイト用）
- nativeClick(selector, options?)
- nativeDoubleClick(selector)
- nativeRightClick(selector)
- nativeHover(selector)
- nativeFocus(selector)
- nativeBlur(selector?)
- nativeScroll(selector, options?)
- nativeSelectText(selector, start?, end?)
- nativeType(selector, text)
- nativePress(key)
- nativeKeyDown(key)
- nativeKeyUp(key)

⚠️ Native Input FunctionsはChromeデバッガーを使用し、バナーが表示されます。
通常のDOM操作で動作しない場合のみ使用してください。`,
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "コードが行うことの簡潔な説明" },
      code: { type: "string", description: "実行するJavaScriptコード" },
    },
    required: ["code"],
  },
};
```

#### browserjs()

AI が生成したコードの中で呼び出せるヘルパー。

- 関数をシリアライズして `chrome.scripting.executeScript` でページコンテキストに注入
- クロージャ変数は使えない。データは引数で渡す (JSON シリアライズ可能な値のみ)
- 実行は `BrowserExecutor.executeScript()` に委譲される

```javascript
// AI が repl ツールで生成するコードの例
const title = await browserjs(() => document.title);
const items = await browserjs(
  (sel) => Array.from(document.querySelectorAll(sel)).map((el) => el.textContent),
  ".product-name",
);
```

#### navigate()

AI が repl ツールで使えるナビゲーションヘルパー。

- `BrowserExecutor.navigateTo()` を呼び出し、DOMContentLoaded 完了を待つ
- `window.location` での直接ナビゲーションは禁止 (description に明記)

```javascript
// AI が repl ツールで生成するコードの例
await navigate("https://example.com");
const title = await browserjs(() => document.title);
```

#### skills（自動注入）

マッチングスキルはsandboxに自動注入される。

```javascript
// skill({ action: 'list' }) で確認したスキルを使用
const info = await browserjs(() => {
  // YouTubeスキルが注入されている場合
  return window.youtube.getVideoInfo();
});

// または extractor.code を直接実行
const extractor = skills.youtube.extractors.getVideoInfo;
const fn = new Function(`return (${extractor.code})`)();
const info = await browserjs(fn);
```

## ツール一覧

### コアツール

| ツール名       | 責務                                              |
| -------------- | ------------------------------------------------- |
| `read_page`    | ページのテキスト・簡略化DOM構造を取得             |
| `repl`         | JS REPL。browserjs/skills/navigate/Native Input等 |
| `pick_element` | インタラクティブな要素選択ピッカー                |
| `screenshot`   | 可視領域のスクリーンショット取得                  |
| `skill`        | サイト固有の自動化ライブラリ（Skill）の管理       |
| `bg_fetch`     | 外部URLのコンテンツ取得（CORS回避、複数URL並列）  |

### bg_fetch ツール

`bg_fetch` は background service worker 経由で外部URLのコンテンツを取得する独立ツール。

- `urls: string[]` で複数URLを1回のtool callで並列取得
- `response_type: "readability"` でHTMLページから本文+リンク一覧を抽出
- background SWの `host_permissions: <all_urls>` によりCORS制限を回避
- offscreen document で `@mozilla/readability` を使った本文抽出

**BrowserExecutor は不使用** — ブラウザ操作ではなくネットワークリクエストのため。
`chrome.runtime.sendMessage` でbackgroundに直接通信する（NativeInput と同パターン）。

詳細: [bg_fetch 設計](../design/bg-fetch.md)

### 将来拡張候補

| ツール名        | 実現方法                   | Port変更 |
| --------------- | -------------------------- | -------- |
| `click_element` | `browserjs()` で実現       | **不要** |
| `type_text`     | `browserjs()` で実現       | **不要** |
| `wait_for`      | `browserjs()` でポーリング | **不要** |
| `extract_table` | `browserjs()` で実現       | **不要** |
| `list_tabs`     | `getActiveTab` の拡張版    | 要検討   |

## メッセージプロトコル

### bg_fetch メッセージ

bg_fetchはBackground経由で外部URLを取得する。readability時はさらにoffscreen documentに転送。

```typescript
// shared/message-types.ts

// sidepanel → background
export interface BgFetchMessage {
  type: "BG_FETCH";
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  responseType: "text" | "json" | "base64" | "readability";
  timeout: number;
}

export interface BgFetchResponse {
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

// background → offscreen (readability時)
export interface ReadabilityMessage {
  type: "BG_READABILITY";
  html: string;
  url: string;
}

export interface ReadabilityResponse {
  success: boolean;
  title?: string;
  content?: string;
  links?: Array<{ text: string; href: string }>;
  error?: string;
}
```

実行フロー:

1. `executeBgFetch()` が `chrome.runtime.sendMessage({ type: "BG_FETCH", ... })`
2. `background/handlers/bg-fetch.ts` でURLバリデーション、fetch実行
3. readability時: `chrome.runtime.sendMessage({ type: "BG_READABILITY", ... })` → offscreen
4. `offscreen/index.ts` でDOMParser + Readability + リンク抽出
5. 結果を返却

### Native Input Functions

Native Input Functions（nativeClick, nativeType等）はBackground経由で実行される。

```typescript
// shared/message-types.ts

export interface NativeInputMessage {
  type: "BG_NATIVE_INPUT";
  action:
    | "click"
    | "doubleClick"
    | "rightClick"
    | "focus"
    | "blur"
    | "hover"
    | "scroll"
    | "selectText"
    | "type"
    | "press"
    | "keyDown"
    | "keyUp";
  tabId: number;
  selector?: string;
  text?: string;
  key?: string;
  options?: NativeInputClickOptions;
  scrollOptions?: NativeInputScrollOptions;
  start?: number;
  end?: number;
}

export interface NativeInputResponse {
  success: boolean;
  error?: string;
}
```

実行フロー:

1. repl sandbox で `nativeClick()` が呼ばれる
2. `chrome.runtime.sendMessage({ type: "BG_NATIVE_INPUT", ... })`
3. `background/handlers/native-input.ts` でデバッガーアタッチ
4. CDP経由でイベント発火
5. デバッガーデタッチ
6. 結果を返却

### その他のツール実行

ツール実行は Background を経由しない。`shared/port.ts` はセッションロックのみを担う。

```typescript
// shared/port.ts

// Side Panel → Background
export type SidepanelMessage =
  | { type: "acquireLock"; sessionId: string; windowId: number }
  | { type: "getLockedSessions" };

// Background → Side Panel
export type BackgroundMessage =
  | { type: "lockResult"; sessionId: string; success: boolean; ownerWindowId?: number }
  | { type: "lockedSessions"; locks: Record<string, number> };
```

## read_page: 簡略化DOMの設計

ページ全体のDOMをそのまま送るとトークン制限を超えるため簡略化する:

- 非表示要素 (`display: none`, `visibility: hidden`) を除外
- `<script>`, `<style>`, `<noscript>`, `<svg>` を除外
- 属性は `id`, `class`, `href`, `src`, `type`, `name`, `placeholder`, `aria-label`, `role` のみ
- テキストは200文字で切り詰め、深さ制限4、本文10,000文字

## repl: セキュリティ方針

AIが生成するコードをページコンテキストで実行するリスクを**現時点では許容する**。

理由:

- これはプロダクトの中核機能であり、ユーザーがAIの操作を監視しながら使う前提
- 既存拡張 も同様のアプローチを採用している

リスク軽減策 (現行):

- `navigate()` ヘルパーを用意し、`window.location` での直接ナビゲーションを tool description で禁止
- ユーザーがサイドパネルでツール呼出しを確認できる (ChatArea の ToolCallBlock)
- `browserjs()` 実行中は REPL オーバーレイを表示し、AIが操作中であることをユーザーに示す

将来の追加対策候補:

- ツール呼出し前のユーザー確認ダイアログ (opt-in)
- 実行可能APIのホワイトリスト

## REPL オーバーレイ

`browserjs()` を含むコードを実行する間、アクティブタブのページ上にシマー (shimmer) オーバーレイを表示する。

- 紫〜赤のグラデーションがページ全体を薄く覆い、AIが操作中であることを示す
- 画面下部のバナーに `args.title` (ツール呼び出しの説明) を表示する
- `chrome.scripting.executeScript` でページに直接 DOM 要素を注入する
- 実行完了 (成功・失敗を問わず) 後に自動で除去する

## Sandbox iframe

`repl` ツールはコードを sandbox iframe (`sandbox.html`) 内で評価する。

**目的**: `eval()` や `new Function()` を使う際に必要な `unsafe-eval` CSP を、Side Panel 全体ではなく sandbox 内に限定する。

**通信パターン**:

```
Side Panel (repl.ts)          sandbox.html
──────────────────            ────────────
iframe をマウント
                              sandbox-ready ──→  Side Panel
exec メッセージ ──────────────→
                              コード評価
                              browserjs() 呼び出し時:
                ←── sandbox-request (browserjs)
BrowserExecutor.executeScript()
                ──→ sandbox-response
                              navigate() 呼び出し時:
                ←── sandbox-request (navigate)
BrowserExecutor.navigateTo()
                ──→ sandbox-response
                              Native Input 呼び出し時:
                ←── sandbox-request (nativeClick)
chrome.runtime.sendMessage()
Background NativeInputHandler
                ──→ sandbox-response
                              eval 完了:
                ←── exec-result (ok/error + console ログ)
```

- sandbox iframe は Side Panel の DOM 内に `display: none` で常駐する
- `postMessage` の origin は `"*"` を使用 (Chrome 拡張の内部通信のため許容)

## スキルシステムのアーキテクチャ

### スキル型定義

```typescript
// src/shared/skill-types.ts

export interface Skill {
  id: string;
  name: string;
  description: string;
  matchers: SkillMatchers;
  extractors: SkillExtractor[];
}

export interface SkillMatchers {
  hosts: string[];
  paths?: string[];
}

export interface SkillExtractor {
  id: string;
  name: string;
  description: string;
  code: string;
  outputSchema: string;
}
```

### スキルレジストリ

```typescript
// src/features/tools/skills/registry.ts

export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();

  register(skill: Skill): void;
  get(id: string): Skill | undefined;
  getAll(): Skill[];
  findMatchingSkills(url: string): SkillMatch[];
}
```

### スキル注入フロー

```
ユーザーがサイトを開く
    ↓
repl ツール実行時
    ↓
SkillRegistry.findMatchingSkills(url)
    ↓
formatSkillsForSandbox(matches)
    ↓
sandbox に skills オブジェクトとして注入
    ↓
browserjs() 内で window.skillId.extractorId() が使用可能
```

## ツール拡張のチェックリスト

1. **単一責務**: そのツールは1つのことだけをするか？
2. **既存能力で実現可能**: `BrowserExecutor` の既存メソッドの組み合わせで済むか？
3. **Port変更が必要か**: 新しいブラウザ能力が必要なら `BrowserExecutor` を拡張
4. **AIの判断容易性**: descriptionからAIが適切に使い分けられるか？
5. **エラー情報**: 失敗時に `ToolError` で原因を返し、AIが次のアクションを判断できるか？

## 関連ドキュメント

- [概要](./overview.md) - 全体アーキテクチャ
- [パッケージ構成](./package-structure.md) - features/tools/, adapters/chrome/ の配置
- [AI接続設計](./ai-connection.md) - ストリーミング中のツール呼び出し
- [エラーハンドリング](./error-handling.md) - ToolError の設計
- [システムプロンプト](../design/system-prompt.md) - ツール使用のプロンプト指示
- [スキルツール詳細](../design/skill-tool.md) - スキルシステムの詳細設計
- [デフォルトスキル](../design/default-skills.md) - 標準スキルセット
- [ネイティブ入力イベント](../design/native-input-events.md) - Native Input Functions の詳細
