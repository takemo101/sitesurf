import type { SkillMatch } from "@/shared/skill-types";
import { assembleSections, type SectionKey } from "./sections";
import { PromptCache, createPromptCacheKey } from "./prompt-cache";

export interface SystemPromptOptions {
  includeSkills?: boolean;
  skills?: SkillMatch[];
  includeToolResultStore?: boolean;
  locale?: string;
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

export function getSystemPromptV2(options: SystemPromptOptions): string {
  const key = createPromptCacheKey(options);
  const cached = cache.get(key);

  if (cached !== null) {
    return cached;
  }

  const base = assembleSections(BASE_SECTIONS);

  const skillsSection =
    options.includeSkills && options.skills ? generateSkillsSection(options.skills) : "";
  const toolResultSection = options.includeToolResultStore
    ? [
        "# Stored Tool Results",
        "",
        "When a tool result includes `Stored: tool_result://<key>`, only a summary is in context.",
        'Use `get_tool_result({"key": "<key>"})` when you need the full content.',
        "The retrieved full content automatically returns to summary form after 1 turn, so only re-fetch it when immediately needed.",
      ].join("\n")
    : "";

  const sections = [base, skillsSection, toolResultSection].filter((section) => section.length > 0);
  const prompt = sections.join("\n\n");

  cache.set(key, prompt);

  return prompt;
}
