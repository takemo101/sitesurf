# Skill Instructions Layer 設計

## 概要

SiteSurf の現行 Skill は **site-specific な executable extractor ライブラリ**として設計されている。
そのため、通常の agent skill のような **AI への指示書**としては使いにくく、特に以下の問題がある。

- Skill Markdown の本文は extractor 定義として解釈され、instruction 本文を保持できない
- Skill が URL / path / DOM だけでマッチすると、その Skill の説明が AI に出るため、**現在のタスクと無関係でも過剰に効く**危険がある
- `github-repo-analyzer-v2` のように、ページ実行モデルと instruction の意図がズレると、AI が誤った実行戦略を選びやすい

本設計では、既存の extractor-centric Skill を壊さずに、**AI に対する site-scoped guidance layer** を追加する。

---

## 背景と問題

### 現行仕様

現行 Skill は次の 2 つの経路で使われる。

1. **prompt 側**
   - `src/features/ai/system-prompt-v2.ts`
   - skill 名 / description / extractor signature / outputSchema / 呼び出し例を AI に提示
2. **runtime 側**
   - `src/features/tools/providers/browser-js-provider.ts`
   - extractor code を `window[skillId][extractorId] = (...)` として page context に注入

この構造は、**「prompt では metadata only」「runtime では executable extractors」** という分離としては合理的だが、通常の agent skill のような instruction-only 運用はできない。

### 現在の課題

#### 1. instruction を Markdown 本文として書けない

現行 parser は YAML frontmatter と `## heading + ```js` の extractor 群だけを読み取る。
このため、長文の guidance / 注意事項 / 優先方針を skill 内に保持できない。

#### 2. Skill match と instruction applicability が同一視される

現行の Skill match は URL / path / DOM に基づく。これは extractor の利用可能性判定としては妥当だが、instruction に対しては粒度が粗い。

例:

- `github.com` にいる
- しかしユーザーがやりたいのは「PR コメントを読む」だけ
- それにもかかわらず「repo 分析では API を優先」系の instruction が常時強く出る

これは **host match = instruction activation** として扱う設計の問題である。

#### 3. 実行戦略 guidance を Skill に乗せたい

SiteSurf では次の選択が頻繁に必要になる。

- `browserjs()` を使うか
- `readPage()` を使うか
- `bgFetch()` を使うか
- native input を優先するか
- site extractor を使うか

この「どう考えるべきか」は executable extractor では表現しにくく、instruction layer が必要である。

---

## 目標

1. Skill Markdown に **instruction を Markdown で記述可能**にする
2. 既存 Skill を **extractors-only の合法な特殊ケース**として扱い、後方互換を維持する
3. `instructions-only` / `extractors-only` / `instructions + extractors` の 3 形態を許容する
4. Skill match と instruction activation を分離し、**関係ないタスクへの過剰適用を防ぐ**
5. prompt / runtime の責務分離を維持する

## 非目標

1. executable extractor を background context で直接実行できるようにすること
2. `executionContext: page | background | auto` を本設計で導入すること
3. 通常の agent skills と完全に同じ発火モデルを再現すること
4. Skill を汎用 Tool Definition 実行エンジンに置き換えること

---

## 設計方針

### 基本方針

Skill は 1 ファイルの Markdown を正本とし、その中に以下 2 レイヤーを共存させる。

1. **Instructions layer**
   - AI に対する site-scoped guidance
   - 優先手順、回避事項、注意点、ヒューリスティクスを記述
2. **Extractors layer**
   - page context で実行可能な site-specific extractor 群

重要なのは、**保存形式は Markdown のまま**維持すること。内部型ではレイヤーを分離するが、ユーザー体験としては 1 つの Skill 文書として扱う。

---

## 仕様

## Skill 型の拡張

`src/shared/skill-types.ts`

```ts
export interface Skill {
  id: string;
  name: string;
  description: string;
  matchers: SkillMatchers;
  extractors: SkillExtractor[];
  version: string;
  scope?: SkillScope;
  metadata?: SkillMetadata;
  instructionsMarkdown?: string;
  instructionBlocks?: SkillInstructionBlock[];
}

export interface SkillInstructionBlock {
  id: string;
  title: string;
  scope: "always" | "task" | "extractor";
  markdown: string;
  activation?: SkillInstructionActivation;
}

export interface SkillInstructionActivation {
  paths?: string[];
  extractorIds?: string[];
  intentHints?: string[];
}
```

### 型設計の意図

- `instructionsMarkdown?` は最小互換のための raw 本文保持
- `instructionBlocks?` は将来の構造化 activation 用
- 初期導入では `instructionsMarkdown` のみでもよい
- `extractors` は配列のまま維持し、**空配列を許容**する

---

## Markdown フォーマット

### 新形式

````md
---
id: github-repo-analyzer
name: GitHub Repo Analyzer
description: GitHub リポジトリ関連の分析支援
scope: global
version: 0.2.0
---

# Instructions

GitHub では page context の extractor を万能手段として扱わないこと。
リポジトリ全体の分析では、まず API / bgFetch / static fetch 系の経路を検討すること。

## Always
GitHub pages may have CSP limitations. DOM extractor は可視範囲の補助取得に限定する。

## Task: Repository Analysis
この guidance は repo 構造分析、ファイル一覧把握、コードベース俯瞰時に適用する。
PR コメント閲覧や issue 読み取りには過剰適用しない。

## Extractor: getVisibleFileList
この extractor は現在表示中 DOM だけを返す。リポジトリ全体の tree は返さない。

# Extractors

## Get Visible File List
<!-- extractor-id: getVisibleFileList -->
<!-- output-schema: { files: string[] } -->
表示中の GitHub ページから可視範囲のファイル一覧を取得する。
```js
function () {
  return {
    files: Array.from(document.querySelectorAll("a"))
      .map((a) => a.textContent?.trim())
      .filter(Boolean),
  };
}
```
````

### 旧形式

既存 Skill は以下の形式を維持する。

````md
---
id: youtube
name: YouTube
hosts:
  - youtube.com
version: 0.1.0
---

## Get Video Info
<!-- extractor-id: getVideoInfo -->
<!-- output-schema: { title: string } -->
動画情報を取得する。
```js
function () {
  return { title: document.title };
}
```
````

### パースルール

1. `# Instructions` がある場合、そのセクション本文を instruction として解釈する
2. `# Extractors` がある場合、その配下の `## ... + ```js` を extractor として解釈する
3. **どちらもない場合は旧形式 fallback** とし、本文全体を extractor 群として解釈する
4. `instructions` と `extractors` はどちらも任意。ただし **両方空は不可**

### セクション認識の厳格条件

誤検出を避けるため、section 切り替えは以下のみ認識する。

- `# Instructions`
- `# Extractors`

以下は section とみなさない。

- `## Instructions`
- コードブロック内の見出し文字列
- extractor description 内の類似テキスト

---

## instruction activation モデル

### 重要原則

**Skill match と instruction activation は別物**とする。

- **Skill match**: extractor が候補として存在するか
- **Instruction activation**: 今のタスクに instruction をどの強さで提示するか

この分離により、`github.com` にいるだけで repo analysis 用 instruction が常時強く効くことを防ぐ。

### activation レベル

Instruction は 3 段階で扱う。

#### 1. passive

Skill が match したことだけを示す軽いガイダンス。

例:

- `GitHub guidance available for repository-analysis tasks.`

用途:

- 無関係なタスクへの過剰干渉を防ぐ
- 「必要なら使える」程度の存在通知に留める

#### 2. contextual

path / DOM / extractor との関連が高いときだけ短い guidance を出す。

例:

- repo root や tree path にいる
- repo 名が見えている
- 関連 extractor が available

表示例:

- `For repository analysis on GitHub, prefer API/bgFetch-style retrieval before relying on DOM extractors.`

#### 3. active

AI の現在のタスク意図が instruction と強く一致するとき、詳細 guidance を出す。

例:

- ユーザー要求が「repo 構造を分析したい」「ファイル一覧を俯瞰したい」
- AI が関連 extractor を使おうとしている

表示例:

- repo analysis 用 instruction block 全文
- extractor-scoped caution

### 初期実装方針

初期段階では完全な intent classification は導入しない。次の軽量ルールから始める。

1. Skill match 時は `passive` の 1 行だけ出す
2. path / DOM 条件が強く一致する instruction block だけ `contextual` に昇格
3. extractor を prompt で提示したとき、その extractor に紐づく caution を追加する
4. active 化は将来拡張とし、初期実装では **明示的 `intentHints` 一致または extractor 関連時のみ**に限定する

---

## prompt 統合方針

`src/features/ai/system-prompt-v2.ts`

### 現行

prompt に Skill metadata を表示する。

- skill 名
- description
- extractor signature
- outputSchema
- 呼び出し例

### 変更後

prompt には以下を出す。

#### 1. Skill summary

従来どおり。

#### 2. Instruction summary

instruction がある Skill には、**段階付きで** short guidance を表示する。

例:

```md
**GitHub Repo Analyzer** (id: github-repo-analyzer, any page)
GitHub リポジトリ関連の分析支援

Guidance:
- GitHub guidance available for repository-analysis tasks.
```

#### 3. Contextual / active guidance

条件が合う場合のみ詳細 guidance を追加する。

例:

```md
Guidance (contextual):
- For repository analysis on GitHub, prefer API/bgFetch-style retrieval before relying on DOM extractors.
- `getVisibleFileList` only returns currently visible DOM content.
```

### prompt 設計原則

1. **instruction 全文を常時入れない**
2. `shownSkillIds` と同様に、instruction も差分注入を前提にする
3. extractor availability と guidance activation は別に扱う
4. 長文 instruction は summarize した上で必要時のみ詳細化する

---

## runtime 統合方針

runtime への変更は最小に留める。

### 変更しないもの

- `formatSkillsForSandbox()`
- `buildSkillInjection()`
- page context への extractor 注入方式

### 理由

Instructions layer は **AI の判断補助**であり、runtime executable code ではない。
したがって sandbox / page context 側へ instruction を持ち込む必要はない。

この設計により、以下を明確に保つ。

- **prompt** = metadata + guidance
- **runtime** = executable extractors only

---

## バリデーション

`src/shared/skill-validation.ts`

### 現行

- extractor が 1 つ以上必須
- function source 必須
- 危険 API 禁止

### 変更後

#### 必須条件

次のいずれかを満たせば Skill として成立する。

- `instructionsMarkdown` が非空
- `extractors.length > 0`

#### reject 条件

- instruction も extractors も空
- site scope なのに hosts が空
- extractor があるのに code が invalid

#### warning 条件

- instruction-only skill なのに description が曖昧
- instruction が長すぎる（例: 2000 文字超）
- extractor code に `bgFetch(` が含まれる
  - 理由: extractor は page context で実行され、bgFetch helper を直接呼べないため

### 追加 warning 提案

- `Instructions` に「必ず bgFetch を使う」等の強い記述があるのに、Skill scope / path 条件が広すぎる
- extractor-scoped caution が extractor ID と対応していない

---

## Skill Editor / 保存形式

### 保存形式

Markdown を正本に維持する。

### 初期導入の UI 方針

1. parser / renderer / prompt を先に対応
2. Settings の Skill Editor は当面 Markdown 生編集を正とする
3. structured UI で instruction block を編集するのは後続フェーズとする

### renderer 方針

`src/shared/skill-markdown.ts`

- instruction がある Skill は新形式で書き出す
- 旧形式 Skill は、再保存時まではそのまま保持してもよい
- 少なくとも **読み込みは新旧両対応** を保証する

---

## 後方互換性

### 基本方針

既存 Skill を **extractors-only の正式な一形態**として扱う。

### 保証すること

1. 既存 Markdown は無修正でロードできる
2. 既存の runtime 注入方式は変えない
3. 既存 Skill は prompt 表示上もほぼ同じ挙動を維持する
4. 新しい instruction-only skill を追加できる

### 非互換になりうる点

- 新 parser 導入後に再保存した Skill の Markdown 形式が新レイアウトになる可能性
- Editor UI が旧形式前提の場合、instruction block の structured editing は当面未対応

### 回避策

- 初期フェーズでは serializer の挙動を保守的にする
- built-in / custom skill の round-trip test を追加する

---

## 具体例

## ケース 1: instructions-only

用途: サイト固有 guidance のみを提供したい

````md
---
id: github-guidance
name: GitHub Guidance
scope: global
version: 0.1.0
---

# Instructions

GitHub では task に応じて API / static fetch / DOM のどれが最適かを先に判断すること。
repo 分析でない限り、repo-analysis guidance を過剰適用しないこと。
````

## ケース 2: extractors-only

用途: 現行互換

````md
---
id: youtube
name: YouTube
hosts:
  - youtube.com
version: 0.1.0
---

## Get Video Info
<!-- extractor-id: getVideoInfo -->
<!-- output-schema: { title: string } -->
動画情報を取得する。
```js
function () {
  return { title: document.title };
}
```
````

## ケース 3: instructions + extractors

用途: ガイダンスと executable helper を同居させたい

````md
---
id: github-repo-analyzer
name: GitHub Repo Analyzer
scope: global
version: 0.2.0
---

# Instructions

## Always
GitHub pages may have CSP limitations.

## Task: Repository Analysis
repo 全体の分析では DOM extractor を万能手段として扱わず、まず API / bgFetch 系を検討する。

# Extractors

## Get Visible File List
<!-- extractor-id: getVisibleFileList -->
<!-- output-schema: { files: string[] } -->
現在表示中のファイル一覧だけを取得する。
```js
function () {
  return { files: [] };
}
```
````

---

## 段階的導入計画

### Phase 1: 最小導入

- `Skill` 型に `instructionsMarkdown?` を追加
- parser を新旧両対応にする
- validator を「instruction または extractor のどちらか必須」に変更
- prompt に instruction summary を追加
- `bgFetch(` warning を追加

### Phase 2: activation 改善

- instruction block を section 単位で parse
- path / extractor 関連で contextual activation
- prompt 差分注入を instruction にも適用

### Phase 3: editor 改善

- Skill Editor に Instructions セクション UI を追加
- block preview / activation preview を追加

### Phase 4: 高度化（将来）

- `intentHints` ベースの active activation
- extractor-scoped guidance の自動提示
- executionContext 設計との連携検討

---

## テスト観点

### parser

- 旧形式 Skill がそのまま parse できる
- instructions-only skill が parse できる
- instructions + extractors skill が parse できる
- `# Instructions` / `# Extractors` のみをトップレベル section と認識する

### renderer

- instruction を含む Skill を新形式で round-trip できる
- 既存 Skill の extractor 情報を壊さない

### prompt

- instruction が常時全文注入されない
- passive / contextual guidance の表示差がある
- extractor-only skill の表示は現行と大きく変わらない

### validation

- instruction-only skill を許可する
- instruction も extractor も空なら reject
- extractor 内 `bgFetch(` を warning にする

---

## 採用判断

本設計では、Skill を以下のように再定義する。

- **従来:** site-specific executable extractor library
- **変更後:** site-scoped guidance + optional executable extractors

ただし runtime 実行モデルは維持し、instruction を executable layer に混ぜない。

これにより、通常の agent skill のような **AI への指示書としての価値**を取り込みつつ、SiteSurf の既存 Skill 資産と page extractor モデルを壊さずに拡張できる。

---

## 関連ファイル

- `src/shared/skill-types.ts`
- `src/shared/skill-parser.ts`
- `src/shared/skill-markdown.ts`
- `src/shared/skill-validation.ts`
- `src/shared/skill-registry.ts`
- `src/features/ai/system-prompt-v2.ts`
- `src/features/tools/repl.ts`
- `src/features/tools/providers/browser-js-provider.ts`
- `src/features/settings/SkillsEditor.tsx`
- `docs/design/skill-system.md`
- `docs/design/system-prompt.md`
- `docs/design/bg-fetch.md`

## 関連ドキュメント

- [スキルシステム](./skill-system.md)
- [システムプロンプト設計](./system-prompt.md)
- [bg_fetch ツール設計](./bg-fetch.md)
- [ツール設計](../architecture/tools.md)
