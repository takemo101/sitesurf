import type { Skill } from "./skill-types";

export const SKILL_DRAFTS_STORAGE_KEY = "sitesurf_skill_drafts";

export interface SkillDraftIssue {
  type: string;
  message: string;
  line?: number;
}

export interface SkillDraftValidation {
  status: "ok" | "warning" | "reject";
  errors: SkillDraftIssue[];
  warnings: SkillDraftIssue[];
}

export interface StoredSkillDraft {
  draftId: string;
  normalizedSkill: Skill;
  validation: SkillDraftValidation;
  suggestedFixes: string[];
  source: "chat";
  createdAt: string;
  updatedAt: string;
}
