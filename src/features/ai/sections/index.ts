import { CORE_IDENTITY } from "./core-identity";
import { TOOL_PHILOSOPHY } from "./tool-philosophy";
import { COMMON_PATTERNS } from "./common-patterns";
import { AVAILABLE_FUNCTIONS } from "./available-functions";
import { SECURITY_BOUNDARY } from "./security-boundary";
import { COMPLETION_PRINCIPLE } from "./completion-principle";

export {
  CORE_IDENTITY,
  TOOL_PHILOSOPHY,
  COMMON_PATTERNS,
  AVAILABLE_FUNCTIONS,
  SECURITY_BOUNDARY,
  COMPLETION_PRINCIPLE,
};

export type SectionKey =
  | "CORE_IDENTITY"
  | "TOOL_PHILOSOPHY"
  | "COMMON_PATTERNS"
  | "AVAILABLE_FUNCTIONS"
  | "SECURITY_BOUNDARY"
  | "COMPLETION_PRINCIPLE";

export const SECTIONS: Record<SectionKey, string> = {
  CORE_IDENTITY,
  TOOL_PHILOSOPHY,
  COMMON_PATTERNS,
  AVAILABLE_FUNCTIONS,
  SECURITY_BOUNDARY,
  COMPLETION_PRINCIPLE,
};

export function assembleSections(keys: SectionKey[]): string {
  return keys.map((key) => SECTIONS[key]).join("\n\n");
}
