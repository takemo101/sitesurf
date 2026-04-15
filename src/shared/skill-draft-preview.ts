import type { StoredSkillDraft } from "./skill-draft-types";

export function buildSkillDraftPreview(draft: StoredSkillDraft): string {
  const lines = [
    `id: ${draft.normalizedSkill.id}`,
    `name: ${draft.normalizedSkill.name}`,
    `description: ${draft.normalizedSkill.description}`,
    `scope: ${draft.normalizedSkill.scope ?? "site"}`,
    `hosts: ${draft.normalizedSkill.matchers.hosts.join(", ") || "(none)"}`,
  ];

  if (draft.normalizedSkill.matchers.paths?.length) {
    lines.push(`paths: ${draft.normalizedSkill.matchers.paths.join(", ")}`);
  }

  if (draft.normalizedSkill.matchers.signals?.length) {
    lines.push(`signals: ${draft.normalizedSkill.matchers.signals.join(", ")}`);
  }

  for (const extractor of draft.normalizedSkill.extractors) {
    lines.push("");
    lines.push(`[extractor:${extractor.id}] ${extractor.name}`);
    lines.push(`description: ${extractor.description}`);
    lines.push(`outputSchema: ${extractor.outputSchema}`);
    if (extractor.selector) {
      lines.push(`selector: ${extractor.selector}`);
    }
    lines.push("code:");
    lines.push(extractor.code);
  }

  return lines.join("\n");
}
