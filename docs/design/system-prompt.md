# システムプロンプト設計

## 現行構成

SiteSurf の prompt 面は 2 層に分かれている。

1. **system prompt** — `src/features/ai/system-prompt-v2.ts`
2. **REPL description SSOT** — `src/shared/repl-description-sections.ts`

この分離が Issue #88-#92 の最終形。

## system prompt 側の責務

`src/features/ai/system-prompt-v2.ts`

### 固定セクション

`BASE_SECTIONS = ["CORE_IDENTITY", "REPL_PHILOSOPHY", "SECURITY_BOUNDARY", "COMPLETION_PRINCIPLE"]`

実体:

- `src/features/ai/sections/core-identity.ts`
- `src/features/ai/sections/repl-philosophy.ts`
- `src/features/ai/sections/security-boundary.ts`
- `src/features/ai/sections/completion-principle.ts`

### 動的セクション

- Skills section
- Current Session: Visited URLs section

### 重要な設計意図

- Tool Philosophy は **system prompt 側**に置く
- REPL の関数一覧や Common Patterns は **REPL description 側**に置く
- 同じ概念を 2 箇所に重複記述しない

## REPL description 側の責務

`src/shared/repl-description-sections.ts`

### 保持する section

- `COMMON_PATTERNS`
- `AVAILABLE_FUNCTIONS`
- `bgFetch()` helper の説明

### 保持しない section

- Core Identity
- Tool Philosophy
- Security Boundary
- Completion Principle

**SSOT:** REPL から呼べる関数を追加・変更する場合は `src/shared/repl-description-sections.ts` を編集する。

## tool surface との整合性

prompt は単独で存在せず、agent に公開する tool list と揃っていなければならない。

### tool list の正本

`src/features/tools/index.ts`

- `ALL_TOOL_DEFS`
- `getAgentToolDefs({ enableBgFetch })`

### 整合させる対象

- `bg_fetch` top-level tool を公開するか
- REPL helper `bgFetch()` を説明に含めるか
- Skills section を入れるか

## Skills section の仕様

### prompt に含めるもの

- skill 名
- description
- available extractor 一覧
- 各 extractor の `outputSchema`
- `window.skillId.extractorId()` 呼び出し例
- Skill に `instructionsMarkdown` がある場合は `Apply: <summary>` 行 (passive は 1 行インライン、contextual は `Apply:` ヘッダ + ` >` で始まるパラグラフ最大 4 行)
- `## Extractor: <id>` ブロックが定義されていれば該当 extractor bullet の下に `Caution:` 行として付加

Skills section は役割 (role) で 2 つに分割する:

- `# Skills: Extractors` — callable な extractor を持つ skill。`browserjs()` 経由で呼ぶ
- `# Skills: Guidance` — instruction-only skill。ユーザが明示しなくても `Apply:` 行を tool 選択や判断に反映する

例:

```js
const info = await browserjs(() => window.youtube.getVideoInfo());
```

### prompt に含めないもの

- `extractor.code`
- `new Function(...)` による再構築例
- sandbox 内部の `skills` runtime object の生構造
- instruction 本文の全文 (常時注入はしない。passive は 1 行、contextual は最大 4 行の要約のみ)

### runtime 側

実際の executable code は `formatSkillsForSandbox()` によって sandbox に注入される。
つまり:

- **prompt** = metadata + guidance summary
- **runtime** = executable extractors

### Activation level

Skill match と instruction activation は分離する。`src/shared/skill-registry.ts` が match 時に level を付与する。

| 条件                                                                 | level        | prompt 表示                                           |
| -------------------------------------------------------------------- | ------------ | ----------------------------------------------------- |
| global skill                                                         | `passive`    | `Apply: <1 行>` (インライン)                          |
| site skill, host-only match                                          | `passive`    | `Apply: <1 行>` (インライン)                          |
| site skill, `matchers.paths` に specific セグメントあり (path match) | `contextual` | `Apply:` ヘッダ + ` >` 始まりのパラグラフ (最大 4 行) |
| site skill, `matchers.paths` が catch-all (`/`, `/**` 等) のみ       | `passive`    | `Apply: <1 行>` (インライン)                          |

`Apply:` ラベルは passive / contextual で共通。差分は **構造** (1 行インライン vs ヘッダ + 複数行ブロック) のみ。AI に内部 activation level の語彙を晒さないための設計。

既読 skill (shownSkillIds に含まれる) は token cost 安定化のため level に関わらず 1 行 `Apply:` インライン形式に揃える。

## bg_fetch 記述の集約

`bg_fetch` の詳しい使い分けは **top-level `bg_fetch` tool description** に集約する。

REPL helper `bgFetch()` 側では:

- top-level `bg_fetch` を参照するだけ
- `enableBgFetch=false` のときは helper 全体を非表示にする

これにより、Issue #86 の要件どおり 1 箇所集約を保つ。

## 現在の section 構成

### system prompt

```text
1. Core Identity
2. Tool Philosophy
3. Security Boundary
4. Completion Principle
5. Skills (optional)
6. Visited URLs (optional)
```

### REPL description

```text
1. Available Functions
2. Common Patterns (optional)
3. bgFetch related lines inside those sections (optional)
```

## prompt cache

`src/features/ai/prompt-cache.ts`

- base prompt は cache key 付きで再利用する
- visited URLs は turn ごとに変動するため base prompt の後ろで合成する
- Tool Philosophy を system prompt 側に寄せることで cache 効率を落とさない

## 実装ファイル

- `src/features/ai/system-prompt-v2.ts`
- `src/features/ai/sections/index.ts`
- `src/features/ai/sections/core-identity.ts`
- `src/features/ai/sections/repl-philosophy.ts`
- `src/features/ai/sections/security-boundary.ts`
- `src/features/ai/sections/completion-principle.ts`
- `src/shared/repl-description-sections.ts`
- `src/features/tools/repl.ts`
- `src/features/tools/bg-fetch.ts`

## テスト観点

- system prompt は Tool Philosophy を含み、Available Functions / Common Patterns を含まない
- Skills section は metadata のみで `extractor.code` を含まない
- `bg_fetch` の説明は system prompt には出ず、top-level tool / REPL description だけに出る
- `enableBgFetch` に応じて tool list と REPL description 内の `bgFetch()` 記述が同時に切り替わる

## 関連ドキュメント

- [アーキテクチャ概要](../architecture/overview.md)
- [AI接続設計](../architecture/ai-connection.md)
- [ツール設計](../architecture/tools.md)
