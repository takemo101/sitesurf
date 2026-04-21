export type SkillScope = "site" | "global";

export interface Skill {
  id: string;
  name: string;
  description: string;
  matchers: SkillMatchers;
  extractors: SkillExtractor[];
  version: string;
  scope?: SkillScope;
  metadata?: SkillMetadata;
  instructionsMarkdown?: string;
}

export interface SkillMetadata {
  domIndicators?: DOMIndicators;
}

export interface DOMIndicators {
  selectors: string[];
  requiredText?: string[];
  minElements?: number;
}

export interface DOMSnapshot {
  elements: Record<string, number>;
  texts: string[];
}

export interface SkillMatchers {
  hosts: string[];
  paths?: string[];
  signals?: string[];
}

export interface SkillExtractor {
  id: string;
  name: string;
  description: string;
  selector?: string;
  code: string;
  outputSchema: string;
}

export interface SkillMatch {
  skill: Skill;
  availableExtractors: SkillExtractor[];
  confidence: number;
}

export interface SkillParseSuccess {
  ok: true;
  skill: Skill;
}

export interface SkillParseFailure {
  ok: false;
  errors: string[];
}

export type SkillParseResult = SkillParseSuccess | SkillParseFailure;
