import type { Skill } from "./skill-types";

export function renderSkillMarkdown(skill: Skill): string {
  const frontmatter: string[] = ["---", `id: ${skill.id}`, `name: ${skill.name}`];

  if (skill.description && skill.description !== skill.name) {
    frontmatter.push(`description: ${skill.description}`);
  }

  if (skill.scope === "global") {
    frontmatter.push("scope: global");
  }

  if (skill.matchers.hosts.length > 0) {
    frontmatter.push("hosts:");
    for (const host of skill.matchers.hosts) {
      frontmatter.push(`  - ${host}`);
    }
  }

  if (skill.matchers.paths && skill.matchers.paths.length > 0) {
    frontmatter.push("paths:");
    for (const path of skill.matchers.paths) {
      frontmatter.push(`  - ${path}`);
    }
  }

  if (skill.metadata?.domIndicators?.selectors?.length) {
    frontmatter.push("selectors:");
    for (const selector of skill.metadata.domIndicators.selectors) {
      frontmatter.push(`  - ${selector}`);
    }
  }

  if (skill.metadata?.domIndicators?.requiredText?.length) {
    frontmatter.push("requiredText:");
    for (const text of skill.metadata.domIndicators.requiredText) {
      frontmatter.push(`  - ${text}`);
    }
  }

  if (skill.metadata?.domIndicators?.minElements !== undefined) {
    frontmatter.push(`minElements: ${skill.metadata.domIndicators.minElements}`);
  }

  frontmatter.push(`version: ${skill.version}`, "---", "");

  const sections = skill.extractors.flatMap((extractor) => [
    `## ${extractor.name}`,
    `<!-- extractor-id: ${extractor.id} -->`,
    `<!-- output-schema: ${extractor.outputSchema} -->`,
    extractor.description,
    "```js",
    extractor.code,
    "```",
    "",
  ]);

  return [...frontmatter, ...sections].join("\n").trimEnd();
}
