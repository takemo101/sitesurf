import type { SkillMatch } from "@/shared/skill-types";
import {
  CORE_IDENTITY,
  TOOL_PHILOSOPHY,
  SECURITY_BOUNDARY,
  COMPLETION_PRINCIPLE,
} from "@/shared/prompt-sections";

export interface VisitedUrlEntry {
  url: string;
  title: string;
  visitedAt: number;
  visitCount: number;
  lastMethod: "navigate" | "read_page" | "bg_fetch";
}

export interface SystemPromptOptions {
  includeSkills?: boolean;
  skills?: SkillMatch[];
  shownSkillIds?: ReadonlySet<string>;
  locale?: string;
  visitedUrls?: VisitedUrlEntry[];
  enableBgFetch?: boolean;
}

// TOOL_PHILOSOPHY は prompt cache 対象に載せるため system prompt 側へ移動。
// REPL description 側には COMMON_PATTERNS / AVAILABLE_FUNCTIONS のみを残す。
const BASE_PROMPT = [CORE_IDENTITY, TOOL_PHILOSOPHY, SECURITY_BOUNDARY, COMPLETION_PRINCIPLE].join(
  "\n\n",
);

function formatPropertyAccess(value: string): string {
  return /^[$A-Z_a-z][0-9A-Z_a-z$]*$/u.test(value) ? `.${value}` : `[${JSON.stringify(value)}]`;
}

function formatWindowSkillCall(skillId: string, extractorId: string): string {
  return `window${formatPropertyAccess(skillId)}${formatPropertyAccess(extractorId)}()`;
}

const INSTRUCTION_SUMMARY_MAX_LEN = 120;
const CONTEXTUAL_PARAGRAPH_MAX_LINES = 4;

function isPromptVisibleSkill(match: SkillMatch): boolean {
  if (match.availableExtractors.length > 0) return true;
  // instructions があっても summarize 可能な本文が無ければ prompt には出さない。
  // 例: 見出しだけ / コードフェンスだけの instructions は AI にとってノイズにしかならない。
  return summarizeInstructions(match.skill.instructionsMarkdown) !== null;
}

/**
 * 本文行を行配列として返す。見出し / コードフェンス内はスキップ。
 * 空行は paragraph 区切りとして空文字で保持する。
 */
function collectBodyLines(instructionsMarkdown: string): string[] {
  const out: string[] = [];
  let inFence = false;
  for (const raw of instructionsMarkdown.split("\n")) {
    if (/^\s*```/.test(raw)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const line = raw.trim();
    if (line.length === 0) {
      out.push("");
      continue;
    }
    if (/^#{1,6}\s/.test(line)) continue;
    const cleaned = line.replace(/^[-*+]\s+/, "").trim();
    if (cleaned.length === 0) continue;
    out.push(cleaned);
  }
  return out;
}

function clampSummaryLength(line: string): string {
  if (line.length <= INSTRUCTION_SUMMARY_MAX_LEN) return line;
  return `${line.slice(0, INSTRUCTION_SUMMARY_MAX_LEN - 1)}…`;
}

/**
 * instructionsMarkdown の先頭本文から 1 行のサマリを作る (passive activation)。
 * 見出し / 空行 / リスト記号 / コードフェンス内は除去し、
 * INSTRUCTION_SUMMARY_MAX_LEN で打ち切る。
 * extractor 専用 caution は extractor bullet 側で扱うので summary には含めない。
 */
function summarizeInstructions(instructionsMarkdown: string | undefined): string | null {
  if (!instructionsMarkdown) return null;
  const topLevel = stripExtractorSections(instructionsMarkdown);
  for (const line of collectBodyLines(topLevel)) {
    if (line === "") continue;
    return clampSummaryLength(line);
  }
  return null;
}

/**
 * extractor-scoped section (`## Extractor: <id>`) を markdown から除去する。
 * 次の `##` 見出しが来るまで、あるいは最後まで読み飛ばす。
 * contextual 要約が extractor 専用 caution を取り込まないようにするため。
 */
function stripExtractorSections(instructionsMarkdown: string): string {
  const lines = instructionsMarkdown.split("\n");
  const out: string[] = [];
  let inExtractorBlock = false;
  for (const raw of lines) {
    const trimmed = raw.trim();
    const isExtractorHeading = /^##\s+Extractor:\s+.+$/.test(trimmed);
    const isOtherHeading = !isExtractorHeading && /^##\s+/.test(trimmed);
    if (isExtractorHeading) {
      inExtractorBlock = true;
      continue;
    }
    if (isOtherHeading) {
      inExtractorBlock = false;
    }
    if (inExtractorBlock) continue;
    out.push(raw);
  }
  return out.join("\n");
}

/**
 * contextual activation 用に先頭パラグラフ (連続本文行の塊) を返す。
 * 最大 CONTEXTUAL_PARAGRAPH_MAX_LINES 行まで。全文注入は避ける。
 * extractor 専用 caution は extractor bullet 側で扱うのでここには含めない。
 */
function contextualInstructionParagraph(instructionsMarkdown: string): string[] {
  const topLevel = stripExtractorSections(instructionsMarkdown);
  const collected: string[] = [];
  let started = false;
  for (const line of collectBodyLines(topLevel)) {
    if (line === "") {
      if (started) break;
      continue;
    }
    started = true;
    collected.push(clampSummaryLength(line));
    if (collected.length >= CONTEXTUAL_PARAGRAPH_MAX_LINES) break;
  }
  return collected;
}

/**
 * `## Extractor: <id>` ブロック直下の本文を extractor ごとに抽出する。
 * extractor ID をキーに、本文の 1 行目 (passive summary と同じ切り詰め) を値として返す。
 * 他のセクションがあるまで本文を読む。全文注入はしない (1 行に要約)。
 */
function extractExtractorCautions(instructionsMarkdown: string | undefined): Map<string, string> {
  const result = new Map<string, string>();
  if (!instructionsMarkdown) return result;

  const lines = instructionsMarkdown.split("\n");
  let inFence = false;
  let currentId: string | null = null;
  let currentBody: string[] = [];

  const finalize = () => {
    if (!currentId) return;
    for (const body of currentBody) {
      if (body === "") continue;
      result.set(currentId, clampSummaryLength(body));
      break;
    }
    currentId = null;
    currentBody = [];
  };

  for (const raw of lines) {
    if (/^\s*```/.test(raw)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const trimmed = raw.trim();
    const extractorMatch = /^##\s+Extractor:\s*(.+?)\s*$/.exec(trimmed);
    if (extractorMatch) {
      finalize();
      currentId = extractorMatch[1];
      continue;
    }
    if (/^#{1,6}\s/.test(trimmed)) {
      // Any other heading terminates the current extractor block.
      finalize();
      continue;
    }

    if (currentId === null) continue;
    if (trimmed.length === 0) {
      if (currentBody.length > 0) currentBody.push("");
      continue;
    }
    const cleaned = trimmed.replace(/^[-*+]\s+/, "").trim();
    if (cleaned.length > 0) currentBody.push(cleaned);
  }
  finalize();
  return result;
}

function generateSkillsSection(
  skills: SkillMatch[],
  shownSkillIds: ReadonlySet<string> = new Set(),
): string {
  const active = skills.filter(isPromptVisibleSkill);

  if (active.length === 0) {
    return "";
  }

  const sections: string[] = [];
  const siteSkills = active.filter((match) => match.skill.scope !== "global");
  const globalSkills = active.filter((match) => match.skill.scope === "global");

  if (siteSkills.length > 0) {
    sections.push(
      "# Skills: Site-Specific Extraction",
      "",
      "For well-known sites, use optimized extraction patterns:",
      "",
    );
    sections.push(renderSkillEntries(siteSkills, shownSkillIds));
  }

  if (globalSkills.length > 0) {
    if (sections.length > 0) sections.push("");
    sections.push(
      "# Skills: Global",
      "",
      "These skills are available on any page and can be used when their extractor fits the task:",
      "",
    );
    sections.push(renderSkillEntries(globalSkills, shownSkillIds));
  }

  return sections.join("\n");
}

function renderSkillEntries(
  skills: SkillMatch[],
  shownSkillIds: ReadonlySet<string> = new Set(),
): string {
  const lines: string[] = [];

  for (const match of skills) {
    const { skill, availableExtractors } = match;
    const activationLevel = match.activationLevel ?? "passive";
    const instructionsMarkdown = skill.instructionsMarkdown;
    const guidanceSummary = summarizeInstructions(instructionsMarkdown);
    const extractorCautions = extractExtractorCautions(instructionsMarkdown);

    if (shownSkillIds.has(skill.id)) {
      // Short format for already-seen skills.
      // 既読 skill はトークン節約のため level に関わらず 1 行 Guidance に揃える。
      lines.push(`- ${skill.name} (id: ${skill.id}): ${skill.description}`);
      if (guidanceSummary) {
        lines.push(`  Guidance: ${guidanceSummary}`);
      }
      lines.push("");
      continue;
    }

    // Full format for new skills
    const target = skill.scope === "global" ? "any page" : skill.matchers.hosts.join(", ");
    lines.push(`**${skill.name}** (id: ${skill.id}, ${target})`);
    lines.push(skill.description);

    if (guidanceSummary) {
      // Use a non-bullet prefix so Guidance lines do not visually blend with
      // the extractor API bullets below (both used "- " previously).
      if (activationLevel === "contextual" && instructionsMarkdown !== undefined) {
        const paragraph = contextualInstructionParagraph(instructionsMarkdown);
        lines.push("Guidance (contextual):");
        for (const bodyLine of paragraph.length > 0 ? paragraph : [guidanceSummary]) {
          lines.push(`  > ${bodyLine}`);
        }
      } else {
        lines.push(`Guidance: ${guidanceSummary}`);
      }
    }
    lines.push("");

    if (availableExtractors.length > 0) {
      for (const ext of availableExtractors) {
        const caution = extractorCautions.get(ext.id);
        lines.push(`- ${ext.id}(): ${ext.outputSchema} — ${ext.description}`);
        if (caution) {
          lines.push(`  Caution: ${caution}`);
        }
      }

      lines.push("");
      lines.push("Call skill extractors from browserjs() via the runtime-injected window object:");
      lines.push("```javascript");
      lines.push(
        `const info = await browserjs(() => ${formatWindowSkillCall(skill.id, availableExtractors[0].id)});`,
      );
      lines.push("```");
      lines.push("");
    }
  }

  return lines.join("\n");
}

export function generateVisitedUrlsSection(entries: VisitedUrlEntry[]): string {
  if (entries.length === 0) return "";
  const lines = entries.map(
    (e) => `- ${e.url} (${e.title}) [${e.visitCount}x, via ${e.lastMethod}]`,
  );
  return `## Current Session: Visited URLs\n${lines.join("\n")}`;
}

export function getSystemPromptV2(options: SystemPromptOptions): string {
  // BASE_PROMPT is a module-level constant, so no cache needed for the base.
  // Skills section is always regenerated (shownSkillIds changes per turn).
  const skillsSection =
    options.includeSkills && options.skills
      ? generateSkillsSection(options.skills, options.shownSkillIds)
      : "";

  const visitedSection = generateVisitedUrlsSection(options.visitedUrls ?? []);
  const sections = [BASE_PROMPT, skillsSection, visitedSection].filter(
    (section) => section.length > 0,
  );
  return sections.join("\n\n");
}

/**
 * Extract skill IDs from the active skills that will be sent in the prompt.
 * Includes instruction-only skills so that their passive guidance is tracked
 * across turns by the shownSkillIds mechanism.
 * Used by agent-loop to track which skills have been shown to the AI.
 */
export function getActiveSkillIds(skills: SkillMatch[]): string[] {
  return skills.filter(isPromptVisibleSkill).map((m) => m.skill.id);
}

/**
 * Generate skills section string for use inside agent-loop per turn.
 * Exposed separately so agent-loop can integrate shownSkillIds tracking.
 */
export function generateSkillsSectionForLoop(
  skills: SkillMatch[],
  shownSkillIds: ReadonlySet<string>,
): string {
  return generateSkillsSection(skills, shownSkillIds);
}
