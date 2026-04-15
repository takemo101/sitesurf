import { renderSkillMarkdown } from "@/shared/skill-markdown";
import type { Skill } from "@/shared/skill-types";

import type { StoredSkill } from "./skills-persistence";

interface UpsertStoredSkillResult {
  ok: boolean;
  updated?: StoredSkill[];
  error?: string;
}

export type StoredSkillList = StoredSkill[];

export function getSkillListItemKey(skillId: string, isBuiltIn: boolean): string {
  return `${isBuiltIn ? "builtin" : "custom"}:${skillId}`;
}

export function canUpsertStoredSkill(
  storedSkills: StoredSkill[],
  skill: Skill,
  editingSkillId: string | null,
  reservedSkillIds: string[] = [],
): string | null {
  const conflict = storedSkills.find(
    (stored) => stored.skill.id === skill.id && stored.skill.id !== editingSkillId,
  );

  if (conflict || reservedSkillIds.includes(skill.id)) {
    return `Skill with id '${skill.id}' already exists`;
  }

  return null;
}

export function upsertStoredSkill(
  storedSkills: StoredSkill[],
  skill: Skill,
  editingSkillId: string | null,
  reservedSkillIds: string[] = [],
): StoredSkill[] {
  const result = tryUpsertStoredSkill(storedSkills, skill, editingSkillId, reservedSkillIds);
  if (!result.ok || !result.updated) {
    throw new Error(result.error ?? "Failed to upsert skill");
  }

  return result.updated;
}

export function tryUpsertStoredSkill(
  storedSkills: StoredSkill[],
  skill: Skill,
  editingSkillId: string | null,
  reservedSkillIds: string[] = [],
): UpsertStoredSkillResult {
  const conflictError = canUpsertStoredSkill(storedSkills, skill, editingSkillId, reservedSkillIds);
  if (conflictError) {
    return {
      ok: false,
      error: conflictError,
    };
  }

  const entry: StoredSkill = {
    skill,
    markdown: renderSkillMarkdown(skill),
  };

  return {
    ok: true,
    updated: editingSkillId
      ? [...storedSkills.filter((stored) => stored.skill.id !== editingSkillId), entry]
      : [...storedSkills, entry],
  };
}
