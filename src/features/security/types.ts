export type SecurityConfidence = "low" | "medium" | "high";

export type SecuritySeverity = "low" | "medium" | "high" | "critical";

export interface InjectionPattern {
  id: string;
  description: string;
  severity: SecuritySeverity;
  test: RegExp;
}

export interface DetectionResult {
  detected: boolean;
  confidence: SecurityConfidence;
  matches: InjectionPattern[];
  sanitizedText: string;
}

export interface SecurityAlert {
  kind: "prompt-injection";
  message: string;
  confidence: SecurityConfidence;
  matches: string[];
}

export interface SecurityEvent {
  source: string;
  sessionId?: string;
  confidence: SecurityConfidence;
  matches: string[];
}

export interface AuditLogger {
  logSecurityEvent(event: SecurityEvent): void | Promise<void>;
}

export interface ToolOutputContext {
  source: string;
  sessionId?: string;
}

export interface ToolOutputSecurityResult {
  result: DetectionResult;
  alert: SecurityAlert | null;
}
