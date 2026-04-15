import type { StoragePort } from "@/ports/storage";
import { SKILL_DRAFTS_STORAGE_KEY, type StoredSkillDraft } from "@/shared/skill-draft-types";

export async function loadSkillDrafts(storage: StoragePort): Promise<StoredSkillDraft[]> {
  return (await storage.get<StoredSkillDraft[]>(SKILL_DRAFTS_STORAGE_KEY)) ?? [];
}

export async function saveSkillDrafts(
  storage: StoragePort,
  drafts: StoredSkillDraft[],
): Promise<void> {
  await storage.set(SKILL_DRAFTS_STORAGE_KEY, drafts);
}
