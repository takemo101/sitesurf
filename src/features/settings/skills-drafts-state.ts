import type { StoredSkillDraft } from "@/shared/skill-draft-types";
import { validateSkillDraftDefinition } from "@/shared/skill-validation";

import { tryUpsertStoredSkill, type StoredSkillList } from "./skills-editor-state";

interface ApproveSkillDraftSuccess {
  ok: true;
  updatedSkills: StoredSkillList;
  remainingDrafts: StoredSkillDraft[];
}

interface ApproveSkillDraftFailure {
  ok: false;
  error: string;
}

export type ApproveSkillDraftResult = ApproveSkillDraftSuccess | ApproveSkillDraftFailure;

export function approveSkillDraft(
  storedSkills: StoredSkillList,
  drafts: StoredSkillDraft[],
  draftId: string,
  reservedSkillIds: string[] = [],
): ApproveSkillDraftResult {
  const draft = drafts.find((entry) => entry.draftId === draftId);

  if (!draft) {
    return {
      ok: false,
      error: "draft not found",
    };
  }

  if (
    typeof draft !== "object" ||
    draft === null ||
    typeof draft.validation !== "object" ||
    draft.validation === null ||
    typeof draft.validation.status !== "string" ||
    typeof draft.normalizedSkill !== "object" ||
    draft.normalizedSkill === null
  ) {
    return {
      ok: false,
      error: "draft payload is malformed",
    };
  }

  if (draft.validation.status === "reject") {
    return {
      ok: false,
      error: "draft validation must be fixed before approval",
    };
  }

  const revalidation = validateSkillDraftDefinition(draft.normalizedSkill);
  if (revalidation.status === "reject") {
    return {
      ok: false,
      error: revalidation.errors.map((error) => error.message).join("; "),
    };
  }

  const result = tryUpsertStoredSkill(storedSkills, draft.normalizedSkill, null, reservedSkillIds);
  if (!result.ok || !result.updated) {
    return {
      ok: false,
      error: result.error ?? "failed to approve draft",
    };
  }

  return {
    ok: true,
    updatedSkills: result.updated,
    remainingDrafts: discardSkillDraft(drafts, draftId),
  };
}

export function discardSkillDraft(drafts: StoredSkillDraft[], draftId: string): StoredSkillDraft[] {
  return drafts.filter((entry) => entry.draftId !== draftId);
}
