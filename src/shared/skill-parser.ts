import type { Skill, SkillParseResult } from "./skill-types";

interface ParsedFrontmatter {
  version?: string;
  scope?: string;
  id?: string;
  name?: string;
  description?: string;
  hosts?: string[];
  paths?: string[];
  signals?: string[];
  selectors?: string[];
  requiredText?: string[];
  minElements?: string;
}

interface ParsedExtractor {
  id: string;
  name: string;
  description: string;
  code: string;
  outputSchema: string;
}

export function parseSkillMarkdown(markdown: string): SkillParseResult {
  const errors: string[] = [];

  const frontmatterResult = extractFrontmatter(markdown);
  if (!frontmatterResult.ok) {
    return { ok: false, errors: frontmatterResult.errors };
  }

  const { frontmatter, body } = frontmatterResult;

  validateFrontmatter(frontmatter, errors);
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const extractors = extractExtractors(body);

  if (extractors.length === 0) {
    errors.push("At least one extractor (## heading + ```js code block) is required");
  }

  for (const ext of extractors) {
    if (!ext.code.trim()) {
      errors.push(`Extractor "${ext.id}" has empty code block`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const skill: Skill = {
    id: frontmatter.id!,
    name: frontmatter.name!,
    description: frontmatter.description || frontmatter.name!,
    scope: frontmatter.scope === "global" ? "global" : "site",
    matchers: {
      hosts: frontmatter.hosts ?? [],
      paths: frontmatter.paths,
    },
    version: frontmatter.version || "0.1.0",
    metadata: buildMetadata(frontmatter),
    extractors: extractors.map((ext) => ({
      id: ext.id,
      name: ext.name,
      description: ext.description,
      code: ext.code,
      outputSchema: ext.outputSchema,
    })),
  };

  return { ok: true, skill };
}

function extractFrontmatter(
  markdown: string,
): { ok: true; frontmatter: ParsedFrontmatter; body: string } | { ok: false; errors: string[] } {
  const trimmed = markdown.trim();
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)([\s\S]*)$/;
  const match = trimmed.match(frontmatterRegex);

  if (!match) {
    return {
      ok: false,
      errors: ["YAML frontmatter not found. Must start with --- and end with ---"],
    };
  }

  const frontmatterText = match[1];
  const body = match[2];
  const frontmatter = parseFrontmatterYaml(frontmatterText);

  return { ok: true, frontmatter, body };
}

function parseFrontmatterYaml(text: string): ParsedFrontmatter {
  const result: ParsedFrontmatter = {};
  const lines = text.split("\n");
  let currentKey: string | null = null;
  let currentArray: string[] | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }

    if (trimmed.startsWith("- ") && currentArray !== null) {
      currentArray.push(trimmed.slice(2).trim());
      continue;
    }

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex > 0) {
      if (currentKey !== null && currentArray !== null) {
        (result as Record<string, unknown>)[currentKey] = currentArray;
        currentArray = null;
      }

      const key = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();

      if (value === "") {
        currentKey = key;
        currentArray = [];
      } else {
        (result as Record<string, unknown>)[key] = value;
        currentKey = null;
        currentArray = null;
      }
    }
  }

  if (currentKey !== null && currentArray !== null) {
    (result as Record<string, unknown>)[currentKey] = currentArray;
  }

  return result;
}

function validateFrontmatter(frontmatter: ParsedFrontmatter, errors: string[]): void {
  if (!frontmatter.id || frontmatter.id.trim() === "") {
    errors.push("Missing or empty 'id' in frontmatter");
  }

  if (!frontmatter.name || frontmatter.name.trim() === "") {
    errors.push("Missing or empty 'name' in frontmatter");
  }

  const scope = frontmatter.scope === "global" ? "global" : "site";

  if (
    scope === "site" &&
    (!frontmatter.hosts || !Array.isArray(frontmatter.hosts) || frontmatter.hosts.length === 0)
  ) {
    errors.push("Missing or empty 'hosts' array in frontmatter");
  }
}

function buildMetadata(frontmatter: ParsedFrontmatter): Skill["metadata"] {
  const selectors = frontmatter.selectors ?? frontmatter.signals;
  const requiredText = frontmatter.requiredText;
  const minElements =
    frontmatter.minElements !== undefined ? Number(frontmatter.minElements) : undefined;

  if (
    (!selectors || selectors.length === 0) &&
    (!requiredText || requiredText.length === 0) &&
    minElements === undefined
  ) {
    return undefined;
  }

  return {
    domIndicators: {
      selectors: selectors ?? [],
      requiredText,
      minElements: Number.isFinite(minElements) ? minElements : undefined,
    },
  };
}

function extractExtractors(body: string): ParsedExtractor[] {
  const extractors: ParsedExtractor[] = [];
  const lines = body.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const headingMatch = line.match(/^##\s*(.+)$/);

    if (headingMatch) {
      const headingText = headingMatch[1].trim();
      let extractorId = toKebabCase(headingText);
      let outputSchema = "unknown";

      i++;
      const descriptionLines: string[] = [];

      while (i < lines.length && !lines[i].startsWith("```") && !lines[i].match(/^##\s/)) {
        const metadataMatch = lines[i]
          .trim()
          .match(/^<!--\s*(extractor-id|output-schema):\s*(.*?)\s*-->$/);
        if (metadataMatch) {
          const [, key, value] = metadataMatch;
          if (key === "extractor-id") {
            extractorId = value;
          } else if (key === "output-schema") {
            outputSchema = value;
          }
          i++;
          continue;
        }
        descriptionLines.push(lines[i]);
        i++;
      }

      let code: string | undefined;
      if (i < lines.length && lines[i].startsWith("```")) {
        i++;
        const codeLines: string[] = [];
        while (i < lines.length && !lines[i].startsWith("```")) {
          codeLines.push(lines[i]);
          i++;
        }
        code = codeLines.join("\n");
        i++;
      }

      const description = descriptionLines.join("\n").trim() || headingText;

      if (code !== undefined) {
        extractors.push({
          id: extractorId,
          name: headingText,
          description,
          code,
          outputSchema,
        });
      }
    } else {
      i++;
    }
  }

  return extractors;
}

function toKebabCase(str: string): string {
  return str
    .replace(/[_\s]+/g, "-")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase()
    .replace(/^-/, "")
    .replace(/-+/g, "-");
}
