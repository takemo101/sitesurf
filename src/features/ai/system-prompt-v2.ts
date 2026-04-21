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

function hasInstructions(match: SkillMatch): boolean {
  return (match.skill.instructionsMarkdown ?? "").trim().length > 0;
}

function isPromptVisibleSkill(match: SkillMatch): boolean {
  return match.availableExtractors.length > 0 || hasInstructions(match);
}

/**
 * instructionsMarkdown の先頭本文から 1 行のサマリを作る。
 * 見出し / 空行 / リスト記号は除去し、INSTRUCTION_SUMMARY_MAX_LEN で打ち切る。
 * 本文を全文注入しない passive activation を初期実装として採用する。
 */
function summarizeInstructions(instructionsMarkdown: string | undefined): string | null {
  if (!instructionsMarkdown) return null;
  for (const raw of instructionsMarkdown.split("\n")) {
    const line = raw.trim();
    if (line.length === 0) continue;
    if (/^#{1,6}\s/.test(line)) continue;
    const cleaned = line.replace(/^[-*+]\s+/, "").trim();
    if (cleaned.length === 0) continue;
    if (cleaned.length <= INSTRUCTION_SUMMARY_MAX_LEN) return cleaned;
    return `${cleaned.slice(0, INSTRUCTION_SUMMARY_MAX_LEN - 1)}…`;
  }
  return null;
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
    const guidanceSummary = summarizeInstructions(skill.instructionsMarkdown);

    if (shownSkillIds.has(skill.id)) {
      // Short format for already-seen skills
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
      lines.push(`Guidance: ${guidanceSummary}`);
    }
    lines.push("");

    if (availableExtractors.length > 0) {
      for (const ext of availableExtractors) {
        lines.push(`- ${ext.id}(): ${ext.outputSchema} — ${ext.description}`);
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
