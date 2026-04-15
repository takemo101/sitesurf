import type { StoragePort } from "@/ports/storage";
import { parseSkillMarkdown } from "@/shared/skill-parser";
import { renderSkillMarkdown } from "@/shared/skill-markdown";
import type { Skill } from "@/shared/skill-types";

const CUSTOM_SKILLS_KEY = "sitesurf_custom_skills";
const LEGACY_CUSTOM_SKILLS_KEY = "tandemweb_custom_skills";

export interface StoredSkill {
  skill: Skill;
  markdown: string;
}

/**
 * カスタムSkillを読み込む。
 * 後方互換: 旧形式 (Skill[]) の場合は StoredSkill[] に変換する。
 */
export async function loadCustomSkills(storage: StoragePort): Promise<StoredSkill[]> {
  const current = (await storage.get<StoredSkill[] | Skill[]>(CUSTOM_SKILLS_KEY)) ?? [];
  const legacy = (await storage.get<StoredSkill[] | Skill[]>(LEGACY_CUSTOM_SKILLS_KEY)) ?? [];

  const normalize = (raw: StoredSkill[] | Skill[]): StoredSkill[] => {
    if (raw.length === 0) return [];
    const first = raw[0];
    if ("id" in first && !("skill" in first)) {
      return (raw as Skill[]).map((skill) => ({ skill, markdown: "" }));
    }
    return raw as StoredSkill[];
  };

  const merged = new Map<string, StoredSkill>();
  for (const item of normalize(legacy)) {
    merged.set(item.skill.id, item);
  }
  for (const item of normalize(current)) {
    merged.set(item.skill.id, item);
  }

  return Array.from(merged.values()).map((entry) => {
    if (entry.markdown.trim()) {
      const parsed = parseSkillMarkdown(entry.markdown);
      if (parsed.ok) {
        return {
          skill: parsed.skill,
          markdown: renderSkillMarkdown(parsed.skill),
        };
      }
    }

    return {
      skill: entry.skill,
      markdown: renderSkillMarkdown(entry.skill),
    };
  });
}

export async function saveCustomSkills(storage: StoragePort, skills: StoredSkill[]): Promise<void> {
  await storage.set(
    CUSTOM_SKILLS_KEY,
    skills.map((entry) => ({
      skill: entry.skill,
      markdown: renderSkillMarkdown(entry.skill),
    })),
  );
  await storage.remove(LEGACY_CUSTOM_SKILLS_KEY);
}
