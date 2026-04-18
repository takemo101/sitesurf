import type { SkillMatch } from "@/shared/skill-types";
import {
  CORE_IDENTITY,
  TOOL_PHILOSOPHY,
  SECURITY_BOUNDARY,
  COMPLETION_PRINCIPLE,
} from "@/shared/prompt-sections";
import { PromptCache, createPromptCacheKey } from "./prompt-cache";

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
  locale?: string;
  visitedUrls?: VisitedUrlEntry[];
  enableBgFetch?: boolean;
}

const cache = new PromptCache();

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

function generateSkillsSection(skills: SkillMatch[]): string {
  const active = skills.filter((m) => m.availableExtractors.length > 0);

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
    sections.push(renderSkillEntries(siteSkills));
  }

  if (globalSkills.length > 0) {
    if (sections.length > 0) sections.push("");
    sections.push(
      "# Skills: Global",
      "",
      "These skills are available on any page and can be used when their extractor fits the task:",
      "",
    );
    sections.push(renderSkillEntries(globalSkills));
  }

  return sections.join("\n");
}

function renderSkillEntries(skills: SkillMatch[]): string {
  const lines: string[] = [];

  for (const match of skills) {
    const { skill, availableExtractors } = match;
    const target = skill.scope === "global" ? "any page" : skill.matchers.hosts.join(", ");
    lines.push(`**${skill.name}** (id: ${skill.id}, ${target})`);
    lines.push(skill.description);
    lines.push("");

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
  const key = createPromptCacheKey(options);
  const cached = cache.get(key);

  let base: string;
  if (cached !== null) {
    base = cached;
  } else {
    const skillsSection =
      options.includeSkills && options.skills ? generateSkillsSection(options.skills) : "";
    base = skillsSection ? `${BASE_PROMPT}\n\n${skillsSection}` : BASE_PROMPT;
    cache.set(key, base);
  }
  const visitedSection = generateVisitedUrlsSection(options.visitedUrls ?? []);
  const sections = [base, visitedSection].filter((section) => section.length > 0);
  return sections.join("\n\n");
}
