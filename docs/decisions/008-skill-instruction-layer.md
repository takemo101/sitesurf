# 008: Skill match と instruction activation を分離する instruction layer の導入

## 状態

承認済 (2026-04 / Issue #159〜#163 の 5 issue + 4 follow-up PR で実装済み)

## 文脈

v0.1.7 までの Skill は **site-specific な executable extractor のライブラリ**として設計されていた。`src/shared/skill-registry.ts` が URL + DOM match で skill を選び、`browserjs()` から `window[skillId][extractorId]()` で呼び出す、という構造。

しかし運用で以下の課題が表面化した。

1. **長文の guidance / 注意事項を skill 内に保持できない**。Markdown 本文は extractor 定義として解釈されるため、通常の agent skill のような「AI への指示書」としては使えない。
2. **Skill match と guidance の "効き" を同一視する設計になっていた**。`github.com` に host-match するだけで repo-analysis 用の方針が常時強く出る、という過剰発火が起きやすい。task が repo 分析と無関係 (issue コメント閲覧、PR review 等) でも同じ guidance が出るため、AI の判断がブレる。
3. **実行戦略の選択ヒューリスティクス** (API / bgFetch / DOM / native input の優先順位等) を表現する場所が無かった。extractor code の中に書いても AI は prompt 側でしか読めない。

解決の方向性として、[skill-instructions-layer.md](../design/skill-instructions-layer.md) では executable extractor 層とは別に **instruction layer** を追加し、activation を match から分離することを提案した。本 ADR はその採用判断と主要決定を記録する。

### 検討した選択肢

#### 案 A: extractor の description を長文化して guidance を詰める

既存モデルを壊さない最小変更。ただし description は 1 extractor に紐づくため、「repo 全体の方針」のような複数 extractor を跨ぐ guidance は書けない。また extractor が 0 個の skill (guidance のみ) は表現不能。

#### 案 B: skill Markdown に自由記述の `notes` セクションを追加する

Frontmatter に `notes: "..."` のように持たせる案。簡潔だが、(1) 活性条件 (いつ出すか) が決められない、(2) 構造化 (Always / Task / Extractor など) の発展余地が乏しい、(3) Markdown 文化と親和しない。

#### 案 C: 独立した instruction layer を導入する (本 ADR の採用案)

Skill Markdown 内に `# Instructions` / `# Extractors` の top-level section を認識し、前者を instruction、後者を extractor 定義として扱う。さらに registry match 時点で `activationLevel` を付与し、prompt 側で表示の強さを段階化する。

## 決定

**案 C を採用する。** 具体的には 3 つの決定を組み合わせる。

### 決定 1: Skill match と instruction activation を別概念として扱う

`SkillMatch` に `activationLevel?: "passive" | "contextual"` を追加し、registry が match 時に決定する。

- **global skill / host-only match / catch-all path (`/`, `/**`等) のみ** →`passive`
- **specific なセグメントを含む path が実際にマッチ** → `contextual`

prompt 側は level に応じて表示量を変える:

- `passive`: 1 行の `Guidance: <summary>`
- `contextual`: `Guidance (contextual):` ヘッダ + 先頭パラグラフ (最大 4 行) を bullet で提示

**これにより `github.com` に match しているだけで repo-analysis guidance が強く出る現象を構造的に防ぐ。** path が repo tree に踏み込んだとき (`/owner/repo/tree/**` 等) にだけ contextual に昇格する。

既存の `SkillMatch.confidence` は match 強度の数値であり、activation level とは semantics が異なる (confidence は内部スコアリング、activation は prompt 表示方針)。意図的に独立させた。

### 決定 2: instruction 本文は全文注入しない (token budget discipline)

prompt に入るのは以下だけ:

- passive: 本文の先頭 1 行 (120 文字で切り詰め)
- contextual: 先頭パラグラフを最大 4 行 (各 120 文字) まで
- extractor-scoped: `## Extractor: <id>` ブロックが定義されていれば、該当 extractor bullet の下に 1 行 `Caution:` として付加
- **本文全文は注入しない。** 残りは将来の active level や skill tool 経由で取得する前提

既読 skill (`shownSkillIds` に含まれる) は level に関わらず 1 行 `Guidance:` に揃え、turn あたりの token コストを安定させる。

### 決定 3: `instructionsMarkdown` は raw string のまま保持し、構造化型は後回し

`Skill.instructionsMarkdown?: string` として生の markdown を保持する。設計書には `SkillInstructionBlock` / `SkillInstructionActivation` の構造化型案もあるが、初期導入時点では導入しない。

- parser / renderer / validator / registry / prompt のすべての経路で raw string で round-trip 可能
- `## Extractor: <id>` のようなセクション解釈は prompt 層の render 時に regex で行う (非破壊)
- 将来 `instructionBlocks` を追加する際も、既存 skill は migration 不要で動き続けられる

**構造化型を最初に入れない**のは、生 markdown のままでも現行ユースケース (passive + contextual + extractor caution) を十分表現できること、および structured data にするタイミングで editor UI も同時に考える必要があり、決定範囲を広げすぎないためである。

## 結果

### 良い面

- instruction-only / extractors-only / mixed の 3 形態を同じ Skill 型で表現可能になり、`github-guidance` のような「実行はしないが guidance を提供する skill」が書けるようになった
- host match だけでは task-specific guidance が強く出ないため、AI の判断ブレが構造的に減る
- 旧形式の Markdown は無変更で読み込める (`# Instructions` / `# Extractors` が無ければ全て extractor として解釈する fallback)
- runtime (`browserjs` / extractor 注入) の責務分離が維持され、instruction layer は **prompt 側の表示判断だけ**に影響する

### 悪い面・残るリスク

- skill 作者が意図的に `paths: ["/**"]` のような catch-all を書いた場合、registry は passive に降格するが、skill の "意図" は broad なまま。**activation rule が skill 設計の良し悪しに依存する**
- 本文を 1〜4 行に要約するルールは markdown の書き方に敏感。見出しの置き方や paragraph 区切りで要約対象の行が変わる
- `Guidance (contextual):` という内部用語が prompt 経由で AI に露出している。将来変える可能性がある
- active level / intent hints / DOM activation / `instructionBlocks` 構造化は future work。必要になったら別 issue で拡張する

### 互換性

- 既存 custom skill / built-in skill は無修正でロード可能
- `validateSkillDefinition` の「extractors 必須」エラーが「instructions または extractors 必須」に緩和された。エラーメッセージ文字列は変わっている (外部に依存箇所がないことは確認済)
- prompt 出力は extractor-only skill に対して bit-identical を維持する

## 関連資料

- 設計詳細: [docs/design/skill-instructions-layer.md](../design/skill-instructions-layer.md)
- 実装概要: [docs/design/skill-system.md](../design/skill-system.md) (`instructionsMarkdown` / `SkillActivationLevel` への言及)
- prompt 表示仕様: [docs/design/system-prompt.md](../design/system-prompt.md) の Activation level 節
- 実装 PR: #165 (parser/renderer), #166 / #167 (validation), #168 / #169 (prompt summary), #170 / #171 (activation), #172 (editor / built-in / docs), #173 (path match 誤判定と fence 統合 fix)
