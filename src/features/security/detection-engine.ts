import { findMatchingPatterns } from "./patterns";
import type { DetectionResult, InjectionPattern, SecurityConfidence } from "./types";

function sanitizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function calculateConfidence(matches: InjectionPattern[]): SecurityConfidence {
  if (matches.length === 0) {
    return "low";
  }

  const severities = matches.map((match) => match.severity);

  if (severities.includes("critical") || matches.length >= 3) {
    return "high";
  }

  if (severities.includes("high") || matches.length >= 2) {
    return "medium";
  }

  return "low";
}

export function detect(text: string): DetectionResult {
  const sanitizedText = sanitizeText(text);
  const matches = sanitizedText === "" ? [] : findMatchingPatterns(sanitizedText);

  return {
    detected: matches.length > 0,
    confidence: calculateConfidence(matches),
    matches,
    sanitizedText,
  };
}
