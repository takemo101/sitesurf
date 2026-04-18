# スキルシステム 設計ドキュメント

## 概要

**Skill** はサイト固有のJavaScriptライブラリで、ドメイン固有の自動化関数を提供します。
ユーザーが作成したスキルは保存され、同じサイトを再度訪れた際に自動的に注入されます。

### 目的

1. **トークン効率**: 同じサイトでの繰り返し操作を、事前定義された関数で置き換える
2. **再利用性**: 一度作成した自動化を次回以降も使用できる
3. **保守性**: サイト変更時にスキル1箇所を修正するだけで済む
4. **LLMの負荷軽減**: DOM探索やセレクター選定を毎回行う必要がなくなる

---

## アーキテクチャ

### データフロー

```
ユーザーがサイトを開く
    ↓
SkillRegistry がマッチングスキルを検索（URL + DOM confidence scoring）
    ↓
マッチングスキルが repl sandbox に自動注入
    ↓
LLM は browserjs() 内でスキル関数を使用可能
    ↓
skill ツールでスキルの管理（作成/更新/削除）
```

### 型定義

```typescript
// src/shared/skill-types.ts

export interface Skill {
  id: string; // 一意識別子（例: "youtube"）
  name: string; // 表示名（例: "YouTube"）
  description: string; // 詳細説明
  version?: string; // セマンティックバージョニング（例: "1.0.0"）
  matchers: SkillMatchers;
  extractors: SkillExtractor[];
  metadata?: SkillMetadata;
}

export interface SkillMatchers {
  hosts: string[]; // ホスト名パターン（例: ["youtube.com", "youtu.be"]）
  paths?: string[]; // パスプレフィックス（オプション）
  domIndicators?: DOMIndicators; // DOMベースのマッチング（オプション）
}

export interface DOMIndicators {
  selectors: string[]; // 必須CSSセレクター
  requiredText?: string[]; // 存在必須テキスト
  minElements?: number; // 最小マッチ要素数
}

export interface SkillExtractor {
  id: string; // 抽出関数名（例: "videoInfo"）
  name: string; // 表示名
  description: string; // 機能説明
  code: string; // JavaScript関数コード
  outputSchema?: string; // 出力スキーマ（JSON Schemaまたは説明）
}

export interface SkillMetadata {
  author?: string;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
}

export interface SkillMatch {
  skill: Skill;
  confidence: number; // マッチング信頼スコア（0〜100）
  availableExtractors: SkillExtractor[];
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
  findMatchingSkills(url: string, domSnapshot?: DOMSnapshot): SkillMatch[];
}
```

**マッチングロジック（confidence scoring）**:

スキルは信頼スコア（0〜100）で評価され、スコアが高い順に返される。

| 条件           | 配点 | 詳細                           |
| -------------- | ---- | ------------------------------ |
| ホスト名マッチ | 40点 | 不一致の場合は即座に 0 を返す  |
| パスマッチ     | 30点 | `paths` 未指定時は満点         |
| DOM indicators | 30点 | `domIndicators` 未指定時は満点 |

DOM indicators の内訳:

- セレクター一致率 × 15点
- requiredText 一致率 × 10点
- minElements 達成 × 5点

---

## Markdown スキル形式

スキルはMarkdown形式で定義します。ビルトインスキルは `public/skills/*.md` に同梱し、
ユーザーカスタムスキルは設定画面で同じ形式のMarkdownを貼り付けて登録できます。

### フォーマット

````markdown
---
id: amazon-product
name: Amazon Product
description: Amazon商品ページの情報抽出
hosts:
  - amazon.co.jp
  - amazon.com
paths:
  - /dp/
  - /gp/product/
---

## productInfo

商品名、価格、評価を取得

```js
return {
  title: document.querySelector("#productTitle")?.textContent?.trim(),
  price: document.querySelector(".a-price .a-offscreen")?.textContent?.trim(),
  rating: document.querySelector("#acrPopover")?.getAttribute("title"),
};
```

## reviews

上位レビューを取得

```js
return Array.from(document.querySelectorAll('[data-hook="review"]'))
  .slice(0, 5)
  .map((el) => ({
    rating: el.querySelector('[data-hook="review-star-rating"]')?.textContent?.trim(),
    title: el.querySelector('[data-hook="review-title"]')?.textContent?.trim(),
    body: el.querySelector('[data-hook="review-body"]')?.textContent?.trim(),
  }));
```
````

### Global Skill フォーマット

URL 非依存の Global Skill は `scope: global` を指定し、`hosts` を省略できます。

````markdown
---
id: dom-mutation
name: DOM Mutation
description: ページ上で再利用可能なDOM改変スキル
scope: global
selectors:
  - body
version: 1.0.0
---

## highlightTargets

主要要素をハイライトして結果を返す

```js
return { ok: true, changed: 3, details: ["h1", "button"] };
```
````

改変系 extractor の戻り値は以下の構造化オブジェクトを推奨します。

```ts
{ ok: true, changed: number, details?: string[] }
{ ok: false, reason: string }
```

### パース規則

| セクション                               | 対応フィールド                                                            | 必須                     |
| ---------------------------------------- | ------------------------------------------------------------------------- | ------------------------ |
| YAML frontmatter `id`                    | `Skill.id`                                                                | Yes                      |
| YAML frontmatter `name`                  | `Skill.name`                                                              | Yes                      |
| YAML frontmatter `description`           | `Skill.description`                                                       | No（省略時はnameと同じ） |
| YAML frontmatter `scope`                 | `Skill.scope`                                                             | No（省略時は `site`）    |
| YAML frontmatter `hosts`                 | `Skill.matchers.hosts`                                                    | site skill のみ必須      |
| YAML frontmatter `paths`                 | `Skill.matchers.paths`                                                    | No                       |
| YAML frontmatter `selectors` / `signals` | `Skill.metadata.domIndicators.selectors`                                  | No                       |
| `## heading`                             | `SkillExtractor.id`（heading textをkebab-case化） + `SkillExtractor.name` | Yes（1つ以上）           |
| heading直後のテキスト                    | `SkillExtractor.description`                                              | No                       |
| ` ```js ` コードブロック                 | `SkillExtractor.code`                                                     | Yes                      |

YAML frontmatter は簡易実装（ライブラリ不使用）でパースします。対応する構文:

- `id`, `name`, `description`: 単一値（string）
- `hosts`, `paths`: 配列（`  - value` 形式）
- ネストや複雑なYAMLは非対応

---

## Skill ツール API

### インターフェース

```typescript
type SkillAction =
  | { action: "list"; url?: string }
  | { action: "get"; name: string; includeLibraryCode?: boolean }
  | { action: "create"; data: Skill }
  | { action: "update"; name: string; updates: Partial<Skill> }
  | { action: "patch"; name: string; patches: SkillPatches }
  | { action: "delete"; name: string };

type SkillPatches = {
  [K in keyof Skill]?: {
    old_string: string;
    new_string: string;
  };
};
```

### アクション詳細

#### 1. list — スキル一覧

```javascript
// 現在のタブURLにマッチするスキルを一覧
await skill({ action: "list" });

// 特定URLにマッチするスキルを一覧
await skill({ action: "list", url: "https://youtube.com/watch?v=xxx" });

// すべてのスキル（フィルタなし）
await skill({ action: "list", url: "" });
```

戻り値: `SkillMatch[]`（confidence 降順）

- `skill`: スキル基本情報（id, name, description, matchers）
- `confidence`: マッチング信頼スコア
- `availableExtractors`: 利用可能な抽出関数一覧

#### 2. get — スキル詳細

```javascript
// 基本情報取得（library code除外、トークン効率）
await skill({ action: "get", name: "youtube" });

// ライブラリコード含む（デバッグ/修正用）
await skill({ action: "get", name: "youtube", includeLibraryCode: true });
```

戻り値: `Skill`

#### 3. create — スキル作成

```javascript
await skill({
  action: "create",
  data: {
    id: "youtube",
    name: "YouTube",
    description: "YouTube動画の情報抽出と操作",
    matchers: {
      hosts: ["youtube.com", "youtu.be", "www.youtube.com"],
      paths: ["/watch", "/shorts"],
    },
    extractors: [
      {
        id: "videoInfo",
        name: "動画情報取得",
        description: "タイトル、説明、視聴回数、チャンネル情報を取得",
        code: `
          const title = document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent?.trim();
          const channel = document.querySelector('ytd-channel-name yt-formatted-string a')?.textContent?.trim();
          return { title, channel };
        `,
        outputSchema: "{ title: string, channel: string }",
      },
    ],
  },
});
```

バリデーション:

- `id` は一意である必要がある
- `matchers.hosts` は必須
- `extractors` は1つ以上必要
- `extractor.code` にナビゲーション・セキュリティ違反パターンが含まれないこと

#### 4. update — スキル更新（部分更新）

```javascript
await skill({
  action: "update",
  name: "youtube",
  updates: {
    description: "更新された説明",
    matchers: {
      hosts: ["youtube.com", "youtu.be", "m.youtube.com"],
    },
  },
});
```

#### 5. patch — スキルパッチ（文字列置換）

```javascript
// セレクター変更等、コードの一部を修正
await skill({
  action: "patch",
  name: "youtube",
  patches: {
    "extractors.videoInfo.code": {
      old_string: "document.querySelector('h1.title')",
      new_string: "document.querySelector('h1.ytd-watch-metadata')",
    },
  },
});
```

用途: サイト変更によるセレクター修正、小さな機能追加。全体を書き換えないためトークン効率が良い。

#### 6. delete — スキル削除

```javascript
await skill({ action: "delete", name: "old-skill" });
```

---

## バリデーション

スキルの登録時（`create` / `update` / Markdownパース時）に `SkillValidator` でコードを検証します。

```typescript
// src/features/tools/skills/validator.ts

export class SkillValidator {
  validate(skill: Skill): ValidationResult;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

interface ValidationError {
  type: "syntax" | "navigation" | "security";
  extractor: string;
  message: string;
}
```

### 1. 構文チェック（SyntaxValidator）

括弧の対応確認（`()`、`[]`、`{}`）。未閉じ・不対応の場合はエラー。

### 2. ナビゲーション検出（NavigationDetector）

以下のパターンを検出し拒否します。ナビゲーションはスキル内ではなくREPLスクリプト側で行う必要があります。

```
window.location =
window.location.href/assign/replace =
window.location.assign/replace/reload(
location =
navigate(
history.pushState/replaceState(
```

### 3. セキュリティスキャン（SecurityScanner）

以下の危険なパターンを検出し拒否します。

| パターン            | 理由             |
| ------------------- | ---------------- |
| `eval(`             | 任意コード実行   |
| `Function(`         | 任意コード実行   |
| `setTimeout("..."`  | 文字列コード実行 |
| `setInterval("..."` | 文字列コード実行 |
| `document.write(`   | DOM破壊リスク    |

バリデーション失敗時はエラーメッセージを返し、そのスキルを無視します（他スキルの読み込みは続行）。

---

## デフォルトスキル

Sitesurfは以下の2つのビルトインスキルを `public/skills/` に同梱しています。

| スキル        | ファイル                         | ドメイン              | 機能                     |
| ------------- | -------------------------------- | --------------------- | ------------------------ |
| youtube       | `public/skills/youtube.md`       | youtube.com, youtu.be | 動画情報、コメント取得   |
| google-search | `public/skills/google-search.md` | google.com            | 検索結果、スニペット取得 |

ビルトインスキルは `public/skills/skills-manifest.json` でファイル一覧を管理します。

```json
{
  "skills": ["youtube.md", "google-search.md"]
}
```

読み込みは `chrome.runtime.getURL('skills/skills-manifest.json')` 経由で行います。

### youtube.md の内容例

````markdown
---
id: youtube
name: YouTube
description: YouTube動画ページの情報抽出
hosts:
  - youtube.com
  - youtu.be
paths:
  - /watch
---

## videoInfo

タイトル、チャンネル名、説明文、再生回数を取得

```js
const title = document
  .querySelector("h1.ytd-watch-metadata yt-formatted-string")
  ?.textContent?.trim();
const channel = document
  .querySelector("ytd-channel-name yt-formatted-string a")
  ?.textContent?.trim();
const description = document
  .querySelector("#description-inline-expander yt-attributed-string")
  ?.textContent?.trim();
const viewCount = document.querySelector("ytd-watch-info-text .bold")?.textContent?.trim();
return { title, channel, description, viewCount };
```

## comments

上位5件のコメントを取得

```js
return Array.from(document.querySelectorAll("ytd-comment-renderer"))
  .slice(0, 5)
  .map((c) => ({
    author: c.querySelector("#author-text")?.textContent?.trim(),
    text: c.querySelector("#content-text")?.textContent?.trim(),
    likes: c.querySelector("#vote-count-middle")?.textContent?.trim(),
  }));
```
````

---

## SkillsEditor

設定画面に追加するカスタムスキル編集UIコンポーネント（`src/features/settings/SkillsEditor.tsx`）。

````
┌─────────────────────────────────────────────┐
│ カスタムSkills                              │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ Textarea (Markdown)                     │ │
│ │ ---                                     │ │
│ │ id: my-skill                            │ │
│ │ name: My Skill                          │ │
│ │ hosts:                                  │ │
│ │   - example.com                         │ │
│ │ ---                                     │ │
│ │                                         │ │
│ │ ## extract                              │ │
│ │ ```js                                   │ │
│ │ return document.title;                  │ │
│ │ ```                                     │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [+追加] [保存]                              │
│                                             │
│ 登録済みSkills:                             │
│ ┌──────────────────────────────────┐        │
│ │ ● youtube (ビルトイン)           │        │
│ │ ● google-search (ビルトイン)     │        │
│ │ ● my-skill (カスタム) [削除]     │        │
│ └──────────────────────────────────┘        │
└─────────────────────────────────────────────┘
````

**要件**:

- 複数のカスタムスキルを追加可能
- 各スキルは独立したMarkdownテキストとして管理
- 保存時にパースしてバリデーション → エラーがあればメッセージ表示
- ビルトインスキルは一覧表示のみ（編集不可）
- カスタムスキルは削除可能
- カスタムスキルは `chrome.storage.local` の `custom-skills` キーに永続化

ビルトインスキルと同じ `id` のカスタムスキルは登録時に拒否されます。

---

## 実装ファイル

| ファイル                                      | 種別 | 説明                                                          |
| --------------------------------------------- | ---- | ------------------------------------------------------------- |
| `src/shared/skill-types.ts`                   | 既存 | 型定義                                                        |
| `src/features/tools/skills/registry.ts`       | 既存 | スキルレジストリ（confidence scoring付きURL + DOMマッチング） |
| `src/features/tools/skills/validator.ts`      | 新規 | SkillValidator（構文・ナビゲーション・セキュリティ検証）      |
| `src/features/tools/skills/skill-parser.ts`   | 新規 | Markdownパーサー                                              |
| `src/features/tools/skills/skill-loader.ts`   | 新規 | ビルトイン + ユーザースキル読み込み                           |
| `src/features/tools/skills/index.ts`          | 変更 | `createDefaultRegistry` → `loadSkillRegistry`（非同期化）     |
| `src/features/tools/skill.ts`                 | 既存 | skill ツール実装                                              |
| `src/features/tools/repl.ts`                  | 既存 | スキル注入（executeRepl内）                                   |
| `src/features/tools/index.ts`                 | 変更 | export の更新                                                 |
| `src/features/settings/SkillsEditor.tsx`      | 新規 | カスタムスキル編集UI                                          |
| `src/features/settings/SettingsPanel.tsx`     | 変更 | SkillsEditorの追加                                            |
| `src/features/settings/skills-persistence.ts` | 既存 | 永続化                                                        |
| `src/features/chat/system-prompt.ts`          | 変更 | Skills部分の動的生成                                          |
| `sidepanel/hooks/use-agent.ts`                | 変更 | レジストリ初期化の非同期化                                    |
| `public/skills/youtube.md`                    | 新規 | ビルトイン: YouTube                                           |
| `public/skills/google-search.md`              | 新規 | ビルトイン: Google検索                                        |
| `public/skills/skills-manifest.json`          | 新規 | ビルトインスキルファイル一覧                                  |

### スキル注入（ライフサイクル）

```typescript
// src/features/tools/repl.ts

async function executeRepl(...) {
  const tab = await browser.getActiveTab();
  const skillMatches = skillRegistry.findMatchingSkills(tab.url);
  const skills = formatSkillsForSandbox(skillMatches);

  sandbox.contentWindow!.postMessage({
    type: "exec",
    code: args.code,
    skills
  }, "*");
}
```

スキルは `new Function(`return (${code})`)()` で復元してから `browserjs(fn)` で実行します。
これは sandbox iframe 経由の実行パスであり、ユーザー自身が入力したコードと同等のセキュリティレベルです。

### 起動シーケンス

```
変更前: useAgent() → createDefaultRegistry() （同期）
変更後: useAgent() → loadSkillRegistry(storage) （非同期）
```

起動時にスキルが読み込まれるまでは空のレジストリで動作し、読み込み完了後に ref を更新します。

---

## ベストプラクティス

### 推奨

- **構造的セレクター**: `data-testid`、`aria-label`、class等を使用
- **エラーハンドリング**: 要素が見つからない場合のフォールバック
- **console.log**: デバッグ用にログを出力
- **単一責任**: 1つのextractorは1つのタスクのみ
- **ドキュメント**: descriptionに制限事項を記載
- **ドメインバリエーション**: `hosts` に `www.` サブドメインや短縮URLも含める

### 避ける

- **テキストベースセレクター**: `.find(el => el.textContent === 'Send')`
- **複雑すぎる関数**: 複数のタスクを1つのextractorで行わない
- **ハードコード**: URLやIDを固定値で埋め込まない
- **eval / Function**: セキュリティリスク（CSP非対応、バリデーションで拒否される）
- **ナビゲーション処理**: スキル内でページ遷移しない（REPLスクリプト側で行う）

### スキル作成ワークフロー（LLM）

1. **機能の特定**: ユーザーと協力して自動化したい機能を列挙
2. **各機能のテスト**: `browserjs()` で実装をテスト → ユーザー確認 → 次の機能へ
3. **スキル構築**: テスト済み関数を `extractors` としてまとめ、適切な `matchers` を設定
4. **保存**: `skill({ action: 'create', ... })` で保存

### スキル更新ワークフロー（サイト変更時）

1. ユーザーから「スキルが壊れた」と報告を受ける
2. `skill({ action: 'get', name: 'xxx', includeLibraryCode: true })` で現状を確認
3. `browserjs()` で新しいセレクターを特定
4. `skill({ action: 'patch', ... })` で修正
5. テストして確認

---

## 関連ドキュメント

- [システムプロンプト](./system-prompt.md) — スキルシステムのプロンプト記載
- [ネイティブ入力イベント](./native-input-events.md) — スキルと併用するNative Input
- [agent-loop 詳細設計](./agent-loop-detail.md) — スキル検出から使用までの流れ
