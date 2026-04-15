import { parseSkillMarkdown } from "@/shared/skill-parser";
import { SkillRegistry } from "@/shared/skill-registry";
import { normalizeLegacyExtractorCode } from "@/shared/skill-validation";
import type { StoragePort } from "@/ports/storage";
import type { Skill } from "./types";
import { validateSkillDefinition } from "./validator";

export const CUSTOM_SKILLS_STORAGE_KEY = "sitesurf_custom_skills";
const LEGACY_CUSTOM_SKILLS_STORAGE_KEY = "tandemweb_custom_skills";
const MANIFEST_PATH = "/skills/skills-manifest.json";

interface BuiltinSkillEntry {
  id: string;
  file: string;
}

interface SkillManifest {
  version?: string;
  builtinSkills: BuiltinSkillEntry[];
}

interface StoredSkillRecord {
  skill: Skill;
  markdown: string;
}

async function fetchBuiltinSkillManifest(): Promise<SkillManifest> {
  const response = await fetch(MANIFEST_PATH);
  if (!response.ok) {
    throw new Error(`Failed to fetch skill manifest: ${response.status}`);
  }
  return await response.json();
}

async function fetchBuiltinSkillMarkdown(path: string): Promise<string> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to fetch skill markdown: ${response.status}`);
  }
  return await response.text();
}

function parseAndValidateSkill(markdown: string, source: string): Skill {
  const result = parseSkillMarkdown(markdown);
  if (!result.ok) {
    const errors = result.errors.join("; ");
    throw new Error(`Failed to parse skill from ${source}: ${errors}`);
  }
  const normalizedSkill = normalizeLegacySkillCodeContract(result.skill);
  const validation = validateSkillDefinition(normalizedSkill);
  if (!validation.valid) {
    const errors = validation.errors.map((error) => error.message).join("; ");
    throw new Error(`Failed to validate skill from ${source}: ${errors}`);
  }
  return normalizedSkill;
}

function ensureStoredSkillIsValid(skill: Skill, source: string): Skill {
  const normalizedSkill = normalizeLegacySkillCodeContract(skill);
  const validation = validateSkillDefinition(normalizedSkill);
  if (!validation.valid) {
    const errors = validation.errors.map((error) => error.message).join("; ");
    throw new Error(`Failed to validate skill from ${source}: ${errors}`);
  }
  return normalizedSkill;
}

function normalizeLegacySkillCodeContract(skill: Skill): Skill {
  return {
    ...skill,
    extractors: skill.extractors.map((extractor) => ({
      ...extractor,
      code: normalizeLegacyExtractorCode(extractor.code),
    })),
  };
}

export async function loadSkillRegistry(storage: StoragePort): Promise<SkillRegistry> {
  const registry = new SkillRegistry();
  const builtInSkillIds = new Set<string>();

  try {
    const manifest = await fetchBuiltinSkillManifest();
    for (const entry of manifest.builtinSkills) {
      try {
        const skillPath = `/skills/${entry.file}`;
        const markdown = await fetchBuiltinSkillMarkdown(skillPath);
        const skill = parseAndValidateSkill(markdown, skillPath);
        registry.register(skill);
        builtInSkillIds.add(skill.id);
      } catch (error) {
        console.warn(`Failed to load built-in skill ${entry.id}:`, error);
      }
    }
  } catch {}

  // 3. カスタムスキルを読み込み（ユーザー定義スキルが最優先）
  const current =
    (await storage.get<StoredSkillRecord[] | Skill[]>(CUSTOM_SKILLS_STORAGE_KEY)) ?? [];
  const legacy =
    (await storage.get<StoredSkillRecord[] | Skill[]>(LEGACY_CUSTOM_SKILLS_STORAGE_KEY)) ?? [];
  const merged = new Map<string, StoredSkillRecord | Skill>();

  for (const entry of legacy) {
    const id = "skill" in entry ? entry.skill.id : entry.id;
    merged.set(id, entry);
  }
  for (const entry of current) {
    const id = "skill" in entry ? entry.skill.id : entry.id;
    merged.set(id, entry);
  }

  if (merged.size > 0) {
    for (const entry of merged.values()) {
      try {
        let skill: Skill;
        if ("skill" in entry && entry.markdown.trim()) {
          try {
            skill = parseAndValidateSkill(entry.markdown, "storage");
          } catch {
            skill = ensureStoredSkillIsValid(entry.skill, "storage");
          }
        } else {
          skill = ensureStoredSkillIsValid(
            "skill" in entry ? entry.skill : (entry as Skill),
            "storage",
          );
        }
        if (builtInSkillIds.has(skill.id)) {
          console.warn(
            `Skipping custom skill '${skill.id}' because it conflicts with a built-in skill`,
          );
          continue;
        }
        registry.register(skill);
      } catch (error) {
        console.warn("Failed to register custom skill:", error);
      }
    }
  }

  return registry;
}
