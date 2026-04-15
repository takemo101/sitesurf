import type { InjectionPattern } from "./types";

export const INJECTION_PATTERNS: InjectionPattern[] = [
  {
    id: "ignore-previous-instructions",
    description: "Ignore or disregard prior instructions.",
    severity: "critical",
    test: /\b(?:ignore|disregard|forget)\b.{0,40}\b(?:previous|prior|above|earlier)\b.{0,40}\b(?:instruction|prompt|message)s?\b/i,
  },
  {
    id: "new-role",
    description: "Attempts to assign a new role or identity.",
    severity: "high",
    test: /\byou are now\b|\byour new role is\b|\bact as\b.{0,30}\b(?:developer|admin|system|assistant)\b/i,
  },
  {
    id: "dan-mode",
    description: "References DAN or jailbreak modes.",
    severity: "critical",
    test: /\bDAN\b|\bjailbreak\b/i,
  },
  {
    id: "system-override",
    description: "Claims authority as system, developer, or admin.",
    severity: "critical",
    test: /\b(?:as|from)\s+(?:the\s+)?(?:system|developer|admin)\b.{0,30}\b(?:ignore|override|must|authorized|instruct(?:ion)?s?)\b|\bsystem override\b/i,
  },
  {
    id: "execute-code",
    description: "Attempts to make the model execute or run code.",
    severity: "high",
    test: /\b(?:execute|run|eval(?:uate)?)\b.{0,20}\b(?:this|the following)\b.{0,20}\b(?:code|script|javascript)\b/i,
  },
  {
    id: "reveal-system-prompt",
    description: "Requests disclosure of system prompts or hidden instructions.",
    severity: "high",
    test: /\b(?:reveal|show|print|display|leak)\b.{0,30}\b(?:system prompt|hidden prompt|instructions?)\b/i,
  },
  {
    id: "bypass-safety",
    description: "Attempts to disable safeguards or policies.",
    severity: "critical",
    test: /\b(?:disable|bypass|ignore|override)\b.{0,30}\b(?:safety|policy|guardrail|restriction)s?\b/i,
  },
  {
    id: "exfiltrate-data",
    description: "Requests sending data externally.",
    severity: "critical",
    test: /\b(?:send|post|upload|exfiltrate|forward)\b.{0,40}\b(?:data|credentials|tokens?|cookies?|secrets?)\b.{0,40}\b(?:https?:\/\/|webhook|endpoint|server)\b/i,
  },
  {
    id: "credential-harvest",
    description: "Requests credentials, tokens, or secrets.",
    severity: "critical",
    test: /\b(?:password|api key|token|secret|credential|session cookie)s?\b.{0,30}\b(?:show|extract|copy|reveal|send)\b|\b(?:show|extract|copy|reveal|send)\b.{0,30}\b(?:password|api key|token|secret|credential|session cookie)s?\b/i,
  },
  {
    id: "tool-rebinding",
    description: "Attempts to reinterpret page content as tool instructions.",
    severity: "high",
    test: /\b(?:treat|use|forward|relay)\b.{0,30}\b(?:page content|page text|scraped data|tool output)\b.{0,30}\b(?:as instructions|as commands)\b/i,
  },
  {
    id: "navigation-without-approval",
    description: "Attempts to force navigation from untrusted content.",
    severity: "high",
    test: /\b(?:immediately|now|right now|without asking|without approval|must|required to)\b.{0,20}\b(?:go to|navigate to|open)\b.{0,40}\bhttps?:\/\/|\b(?:go to|navigate to|open)\b.{0,20}\bhttps?:\/\/.{0,30}\b(?:immediately|now|right now|without asking|without approval)\b/i,
  },
  {
    id: "authority-impersonation",
    description: "Claims elevated trust via authority impersonation.",
    severity: "high",
    test: /\bI am the (?:developer|administrator|system)\b|\btrusted override\b/i,
  },
  {
    id: "output-format-manipulation",
    description: "Attempts to coerce hidden chain-of-thought or raw prompt output.",
    severity: "medium",
    test: /\b(?:respond|output|return)\b.{0,30}\b(?:raw|verbatim|exact)\b.{0,30}\b(?:prompt|chain[- ]of[- ]thought|reasoning)\b/i,
  },
  {
    id: "instruction-priority-inversion",
    description: "Claims page instructions outrank the user or system.",
    severity: "critical",
    test: /\b(?:this page|these instructions)\b.{0,30}\b(?:override|take priority over|are more important than)\b.{0,30}\b(?:user|system|developer)\b/i,
  },
  {
    id: "sandbox-escape",
    description: "Attempts to break containment or access restricted context.",
    severity: "high",
    test: /\b(?:escape|break out of|bypass)\b.{0,20}\b(?:sandbox|isolation|restriction)s?\b/i,
  },
  {
    id: "base64-obfuscation",
    description: "Requests decoding hidden instructions from encoded content.",
    severity: "medium",
    test: /\b(?:decode|unwrap|deobfuscate)\b.{0,30}\b(?:base64|encoded instructions?|hidden message)\b/i,
  },
];

export function findMatchingPatterns(text: string): InjectionPattern[] {
  return INJECTION_PATTERNS.filter((pattern) => pattern.test.test(text));
}
