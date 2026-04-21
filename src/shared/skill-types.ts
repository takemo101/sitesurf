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

/**
 * Instruction activation level: どれだけ強く guidance を prompt に出すかを決める。
 * - passive: skill が match しただけ (host-only / global)。ノイズを避けるため 1 行だけ出す
 * - contextual: path 等が一致して skill が task に近い状況。より詳細な guidance を出す
 */
export type SkillActivationLevel = "passive" | "contextual";

export interface SkillMatch {
  skill: Skill;
  availableExtractors: SkillExtractor[];
  confidence: number;
  activationLevel?: SkillActivationLevel;
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
