/**
 * テスト専用ヘルパー
 * features/tools/__tests__/ が features/settings に直接依存しないよう、
 * 必要最小限のスキル操作ロジックをここに集約する。
 */
import type { StoragePort } from "@/ports/storage";
import { renderSkillMarkdown } from "@/shared/skill-markdown";
import { validateSkillDraftDefinition } from "@/shared/skill-validation";
import type { Skill } from "@/shared/skill-types";
import type { StoredSkillDraft } from "@/shared/skill-draft-types";

const CUSTOM_SKILLS_KEY = "sitesurf_custom_skills";
const LEGACY_CUSTOM_SKILLS_KEY = "tandemweb_custom_skills";

export interface StoredSkill {
  skill: Skill;
  markdown: string;
}

export async function saveCustomSkills(
  storage: StoragePort,
  skills: StoredSkill[],
): Promise<void> {
  await storage.set(
    CUSTOM_SKILLS_KEY,
    skills.map((entry) => ({
      skill: entry.skill,
      markdown: renderSkillMarkdown(entry.skill),
    })),
  );
  await storage.remove(LEGACY_CUSTOM_SKILLS_KEY);
}

interface ApproveSuccess {
  ok: true;
  updatedSkills: StoredSkill[];
  remainingDrafts: StoredSkillDraft[];
}

interface ApproveFailure {
  ok: false;
  error: string;
}

export type ApproveSkillDraftResult = ApproveSuccess | ApproveFailure;

export function approveSkillDraft(
  storedSkills: StoredSkill[],
  drafts: StoredSkillDraft[],
  draftId: string,
): ApproveSkillDraftResult {
  const draft = drafts.find((entry) => entry.draftId === draftId);

  if (!draft) {
    return { ok: false, error: "draft not found" };
  }

  if (draft.validation.status === "reject") {
    return { ok: false, error: "draft validation must be fixed before approval" };
  }

  const revalidation = validateSkillDraftDefinition(draft.normalizedSkill);
  if (revalidation.status === "reject") {
    return { ok: false, error: revalidation.errors.map((e) => e.message).join("; ") };
  }

  const conflict = storedSkills.find((s) => s.skill.id === draft.normalizedSkill.id);
  if (conflict) {
    return { ok: false, error: `Skill with id '${draft.normalizedSkill.id}' already exists` };
  }

  const newEntry: StoredSkill = {
    skill: draft.normalizedSkill,
    markdown: renderSkillMarkdown(draft.normalizedSkill),
  };

  return {
    ok: true,
    updatedSkills: [...storedSkills, newEntry],
    remainingDrafts: drafts.filter((d) => d.draftId !== draftId),
  };
}
