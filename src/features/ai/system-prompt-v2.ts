import {
  contextualInstructionParagraph,
  extractExtractorCautions,
  summarizeInstructions,
} from "@/shared/skill-instructions";
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

function isPromptVisibleSkill(match: SkillMatch): boolean {
  if (match.availableExtractors.length > 0) return true;
  // instructions があっても summarize 可能な本文が無ければ prompt には出さない。
  // 例: 見出しだけ / コードフェンスだけの instructions は AI にとってノイズにしかならない。
  return summarizeInstructions(match.skill.instructionsMarkdown) !== null;
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
