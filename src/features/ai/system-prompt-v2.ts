import type { SkillMatch } from "@/shared/skill-types";
import { assembleSections, type SectionKey } from "./sections";
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
}

const cache = new PromptCache();

const BASE_SECTIONS: SectionKey[] = [
  "CORE_IDENTITY",
  "TOOL_PHILOSOPHY",
  "AVAILABLE_FUNCTIONS",
  "COMMON_PATTERNS",
  "SECURITY_BOUNDARY",
  "COMPLETION_PRINCIPLE",
];

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
    lines.push(`**${skill.name}** (${target}):\n`);

    for (const ext of availableExtractors) {
      lines.push(`- ${ext.name}: ${ext.description}`);
    }

    lines.push("");
    lines.push("Run extractor.code by reconstructing it first:");
    lines.push("```javascript");
    lines.push(
      `const code = skills["${skill.id}"].extractors["${availableExtractors[0].id}"].code;`,
    );
    lines.push("const fn = new Function(`return (${code})`)();");
    lines.push("const result = await browserjs(fn);");
    lines.push("```");
    lines.push("");
    lines.push("```javascript");
    lines.push(availableExtractors[0].code.trim());
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
    const baseSections = assembleSections(BASE_SECTIONS);
    const skillsSection =
      options.includeSkills && options.skills ? generateSkillsSection(options.skills) : "";
    base = skillsSection ? `${baseSections}\n\n${skillsSection}` : baseSections;
    cache.set(key, base);
  }

  const visitedSection = generateVisitedUrlsSection(options.visitedUrls ?? []);
  return visitedSection ? `${base}\n\n${visitedSection}` : base;
}
