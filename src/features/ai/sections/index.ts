import { CORE_IDENTITY } from "./core-identity";
import { REPL_PHILOSOPHY } from "./repl-philosophy";
import { SECURITY_BOUNDARY } from "./security-boundary";
import { COMPLETION_PRINCIPLE } from "./completion-principle";

export { CORE_IDENTITY, REPL_PHILOSOPHY, SECURITY_BOUNDARY, COMPLETION_PRINCIPLE };

export type SectionKey =
  | "CORE_IDENTITY"
  | "REPL_PHILOSOPHY"
  | "SECURITY_BOUNDARY"
  | "COMPLETION_PRINCIPLE";

export const SECTIONS: Record<SectionKey, string> = {
  CORE_IDENTITY,
  REPL_PHILOSOPHY,
  SECURITY_BOUNDARY,
  COMPLETION_PRINCIPLE,
};

export function assembleSections(keys: SectionKey[]): string {
  return keys.map((key) => SECTIONS[key]).join("\n\n");
}
