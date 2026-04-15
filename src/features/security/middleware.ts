import { detect } from "./detection-engine";
import type {
  AuditLogger,
  SecurityAlert,
  ToolOutputContext,
  ToolOutputSecurityResult,
} from "./types";

export interface SecurityMiddlewareOptions {
  auditLogger?: AuditLogger;
}

export interface SecurityMiddleware {
  processToolOutput(text: string, context: ToolOutputContext): Promise<ToolOutputSecurityResult>;
}

function createAlert(confidence: SecurityAlert["confidence"], matches: string[]): SecurityAlert {
  return {
    kind: "prompt-injection",
    message: "Suspicious instruction-like content was detected in tool output.",
    confidence,
    matches,
  };
}

export function createSecurityMiddleware(
  options: SecurityMiddlewareOptions = {},
): SecurityMiddleware {
  return {
    async processToolOutput(text, context) {
      const result = detect(text);

      if (!result.detected) {
        return { result, alert: null };
      }

      const matchIds = result.matches.map((match) => match.id);
      const alert = createAlert(result.confidence, matchIds);

      try {
        await options.auditLogger?.logSecurityEvent({
          source: context.source,
          sessionId: context.sessionId,
          confidence: result.confidence,
          matches: matchIds,
        });
      } catch {
        // Audit logging must not break primary tool-output processing.
      }

      return { result, alert };
    },
  };
}
