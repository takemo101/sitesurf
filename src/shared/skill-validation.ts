import type { Skill } from "./skill-types";

export interface ValidationError {
  type: "syntax" | "navigation" | "security";
  message: string;
  line?: number;
}

export interface ValidationWarning {
  type: "quality" | "security-warning" | "navigation-warning";
  message: string;
  line?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface SkillDraftValidationResult {
  status: "ok" | "warning" | "reject";
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

const FUNCTION_SOURCE_ERROR =
  "extractor code must be a full function source (for example `function () { ... }` or `async function () { ... }`)";

const NAVIGATION_PATTERNS: readonly { pattern: RegExp; description: string }[] = [
  { pattern: /window\.location\s*=\s*/g, description: "window.location assignment" },
  { pattern: /window\.location\.href\s*=\s*/g, description: "window.location.href assignment" },
  { pattern: /document\.location\s*=\s*/g, description: "document.location assignment" },
  {
    pattern: /document\.location\.href\s*=\s*/g,
    description: "document.location.href assignment",
  },
  {
    pattern: /document\.location\.pathname\s*=\s*/g,
    description: "document.location.pathname assignment",
  },
  { pattern: /document\.location\.assign\s*\(/g, description: "document.location.assign()" },
  {
    pattern: /document\.location\.replace\s*\(/g,
    description: "document.location.replace()",
  },
  { pattern: /document\.location\.reload\s*\(/g, description: "document.location.reload()" },
  {
    pattern: /window\.location\.pathname\s*=\s*/g,
    description: "window.location.pathname assignment",
  },
  { pattern: /window\.location\.assign\s*\(/g, description: "window.location.assign()" },
  { pattern: /window\.location\.replace\s*\(/g, description: "window.location.replace()" },
  { pattern: /window\.location\.reload\s*\(/g, description: "window.location.reload()" },
  {
    pattern: /(?<![\w.])location\s*=\s*/g,
    description: "location assignment",
  },
  { pattern: /(?<![\w.])location\.href\s*=\s*/g, description: "location.href assignment" },
  {
    pattern: /(?<![\w.])location\.pathname\s*=\s*/g,
    description: "location.pathname assignment",
  },
  { pattern: /(?<![\w.])location\.assign\s*\(/g, description: "location.assign()" },
  { pattern: /(?<![\w.])location\.replace\s*\(/g, description: "location.replace()" },
  { pattern: /(?<![\w.])location\.reload\s*\(/g, description: "location.reload()" },
  { pattern: /history\.pushState\s*\(/g, description: "history.pushState()" },
  { pattern: /history\.replaceState\s*\(/g, description: "history.replaceState()" },
  {
    pattern:
      /(?:window|document|top|self|globalThis)\s*(?:\.\s*location|\[\s*["']location["']\s*\])\s*(?:\.\s*(?:assign|replace|reload)\s*\(|\[\s*["'](?:assign|replace|reload)["']\s*\]\s*\(|\.\s*(?:href|pathname)\s*=|\[\s*["'](?:href|pathname)["']\s*\]\s*=)/g,
    description: "computed/global location access",
  },
  {
    pattern: /top\s*\.\s*location\s*=/g,
    description: "top location assignment",
  },
  {
    pattern: /(?:self|globalThis)\s*\.\s*location\s*=/g,
    description: "self/globalThis location assignment",
  },
  {
    pattern:
      /(?:window|document|top|self|globalThis)\s*\[\s*["']location["']\s*\]\s*\[\s*["'](?:assign|replace|reload)["']\s*\]\s*\(/g,
    description: "nested computed location access",
  },
  {
    pattern: /window\["location"\]\["assign"\]\s*\(/g,
    description: 'window["location"]["assign"]()',
  },
  {
    pattern: /window\s*\[\s*["']location["']\s*\]\s*=/g,
    description: 'window["location"] assignment',
  },
  {
    pattern:
      /(?<![\w.])location\s*(?:\.\s*(?:assign|replace|reload)\s*\(|\[\s*["'](?:assign|replace|reload)["']\s*\]\s*\(|\.\s*(?:href|pathname)\s*=|\[\s*["'](?:href|pathname)["']\s*\]\s*=)/g,
    description: "computed location access",
  },
];

const SECURITY_PATTERNS: readonly { pattern: RegExp; description: string }[] = [
  { pattern: /(?<![\w.])eval\s*\(/g, description: "eval()" },
  { pattern: /(?<![\w.])Function\s*\(/g, description: "Function()" },
  { pattern: /new\s+Function\s*\(/g, description: "new Function()" },
  {
    pattern: /setTimeout\s*\(\s*["']/g,
    description: "setTimeout with string argument",
  },
  {
    pattern: /setInterval\s*\(\s*["']/g,
    description: "setInterval with string argument",
  },
  { pattern: /document\.write\s*\(/g, description: "document.write()" },
  {
    pattern: /document\s*\[\s*["']write["']\s*\]\s*\(/g,
    description: 'document["write"]()',
  },
  {
    pattern:
      /(?:window|self|top|globalThis)\s*(?:\.\s*(?:eval|Function)|\[\s*["'](?:eval|Function)["']\s*\])\s*\(/g,
    description: "global eval/Function",
  },
  { pattern: /\(\s*0\s*,\s*eval\s*\)\s*\(/g, description: "indirect eval()" },
  {
    pattern: /\.constructor\s*\.\s*constructor\s*\(/g,
    description: "constructor.constructor()",
  },
  { pattern: /\.submit\s*\(/g, description: "form.submit()" },
  { pattern: /new\s+Image\s*\(/g, description: "new Image()" },
];

const SECURITY_WARNING_PATTERNS: readonly { pattern: RegExp; description: string }[] = [
  { pattern: /(?<![\w.])fetch\s*\(/g, description: "fetch()" },
  {
    pattern: /(?:window|self|top|globalThis)\s*(?:\.\s*fetch|\[\s*["']fetch["']\s*\])\s*\(/g,
    description: "global fetch()",
  },
  { pattern: /navigator\.sendBeacon\s*\(/g, description: "navigator.sendBeacon()" },
  {
    pattern: /navigator\s*\[\s*["']sendBeacon["']\s*\]\s*\(/g,
    description: 'navigator["sendBeacon"]()',
  },
  { pattern: /new\s+XMLHttpRequest\s*\(/g, description: "new XMLHttpRequest()" },
  { pattern: /new\s+WebSocket\s*\(/g, description: "new WebSocket()" },
];

const NAVIGATION_WARNING_PATTERNS: readonly { pattern: RegExp; description: string }[] = [
  { pattern: /(?<![\w.])navigate\s*\(/g, description: "navigate()" },
];

export function validateSkillCode(code: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const sanitized = sanitizeForValidation(code);

  checkBracketBalance(sanitized, errors);
  checkNavigationPatterns(sanitized, errors);
  checkSecurityPatterns(sanitized, errors);
  checkSecurityWarningPatterns(sanitized, warnings);
  checkNavigationWarningPatterns(sanitized, warnings);

  return { valid: errors.length === 0, errors, warnings };
}

export function validateSkillDefinition(skill: Skill): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  errors.push(...collectSkillStructureErrors(skill));

  const hosts = Array.isArray(skill.matchers?.hosts) ? skill.matchers.hosts : [];
  const duplicateHosts = new Set<string>();
  const seenHosts = new Set<string>();
  for (const host of hosts) {
    if (seenHosts.has(host)) {
      duplicateHosts.add(host);
    }
    seenHosts.add(host);
  }
  for (const host of duplicateHosts) {
    errors.push({
      type: "syntax",
      message: `duplicate host matcher: ${host}`,
    });
  }

  const duplicateExtractorIds = new Set<string>();
  const seenExtractorIds = new Set<string>();

  const extractors = Array.isArray(skill.extractors) ? skill.extractors : [];

  for (const extractor of extractors) {
    if (!isRecord(extractor)) {
      errors.push({ type: "syntax", message: "Extractor must be an object" });
      continue;
    }

    if (seenExtractorIds.has(extractor.id)) {
      duplicateExtractorIds.add(extractor.id);
    }
    seenExtractorIds.add(extractor.id);

    if (typeof extractor.code === "string") {
      const result = validateSkillCode(extractor.code);
      errors.push(
        ...result.errors.map((error) => ({
          ...error,
          message: `${extractor.id}: ${error.message}`,
        })),
      );
      warnings.push(
        ...result.warnings.map((warning) => ({
          ...warning,
          message: `${extractor.id}: ${warning.message}`,
        })),
      );
    }
  }

  for (const extractorId of duplicateExtractorIds) {
    errors.push({
      type: "syntax",
      message: `duplicate extractor id: ${extractorId}`,
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateSkillDraftDefinition(skill: Skill): SkillDraftValidationResult {
  const validation = validateSkillDefinition(skill);
  const contractErrors = collectDraftContractErrors(skill);
  const warnings = [...collectDraftWarnings(skill), ...validation.warnings];

  if (!validation.valid || contractErrors.length > 0) {
    return {
      status: "reject",
      errors: [...validation.errors, ...contractErrors],
      warnings,
    };
  }

  if (warnings.length > 0) {
    return {
      status: "warning",
      errors: [],
      warnings,
    };
  }

  return {
    status: "ok",
    errors: [],
    warnings: [],
  };
}

function collectDraftWarnings(skill: Skill): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  if (safeTrim(skill.description).length < 10) {
    warnings.push({
      type: "quality",
      message: "description is too short",
    });
  }

  const extractors = Array.isArray(skill.extractors) ? skill.extractors : [];

  for (const extractor of extractors) {
    if (!isRecord(extractor)) {
      warnings.push({
        type: "quality",
        message: "extractor entry must be an object",
      });
      continue;
    }

    if (safeTrim(extractor.description).length < 10) {
      warnings.push({
        type: "quality",
        message: `${extractor.id}: description is too short`,
      });
    }

    const schema = safeTrim(extractor.outputSchema);
    if (schema === "" || schema === "unknown") {
      warnings.push({
        type: "quality",
        message: `${extractor.id}: outputSchema should be more specific`,
      });
    }

    if (!/\breturn\b/.test(extractor.code)) {
      warnings.push({
        type: "quality",
        message: `${extractor.id}: code does not contain an explicit return`,
      });
    }
  }

  return warnings;
}

function collectDraftContractErrors(skill: Skill): ValidationError[] {
  const errors: ValidationError[] = [];
  const extractors = Array.isArray(skill.extractors) ? skill.extractors : [];

  for (const extractor of extractors) {
    if (!isRecord(extractor) || typeof extractor.code !== "string") {
      continue;
    }

    if (!isExtractorFunctionSource(extractor.code)) {
      errors.push({
        type: "syntax",
        message: `${extractor.id}: ${FUNCTION_SOURCE_ERROR}`,
      });
    }
  }

  return errors;
}

export function isExtractorFunctionSource(code: string): boolean {
  const trimmed = safeTrim(code);
  if (trimmed === "") {
    return false;
  }

  // function または async function で始まること
  if (!/^(async\s+)?function\b/.test(trimmed)) {
    return false;
  }

  // 閉じ波括弧で終わること
  if (!trimmed.endsWith("}")) {
    return false;
  }

  // 波括弧のバランスが取れていること
  // sanitizeForValidation で文字列・コメント・テンプレートリテラル内の文字を
  // 空白に置換してから波括弧をカウントする
  // （new Function は extension page の CSP でブロックされるため使用不可）
  const sanitized = sanitizeForValidation(trimmed);
  let depth = 0;
  for (let i = 0; i < sanitized.length; i++) {
    const ch = sanitized[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    if (depth < 0) return false;
  }

  return depth === 0;
}

export function normalizeLegacyExtractorCode(code: string): string {
  const trimmed = safeTrim(code);
  if (trimmed === "") {
    return "";
  }

  if (isExtractorFunctionSource(trimmed)) {
    return trimmed;
  }

  return `function () {\n${trimmed}\n}`;
}

function collectSkillStructureErrors(skill: Skill): ValidationError[] {
  const errors: ValidationError[] = [];
  const scope = skill.scope ?? "site";

  if (safeTrim(skill.id) === "") {
    errors.push({ type: "syntax", message: "Skill id is required" });
  }

  if (safeTrim(skill.name) === "") {
    errors.push({ type: "syntax", message: "Skill name is required" });
  }

  if (
    scope === "site" &&
    (!skill.matchers || !Array.isArray(skill.matchers.hosts) || skill.matchers.hosts.length === 0)
  ) {
    errors.push({
      type: "syntax",
      message: "Skill matchers.hosts is required and must not be empty",
    });
  }

  const extractors = Array.isArray(skill.extractors) ? skill.extractors : [];

  if (extractors.length === 0) {
    errors.push({
      type: "syntax",
      message: "Skill extractors is required and must have at least one extractor",
    });
  }

  for (const extractor of extractors) {
    if (!isRecord(extractor)) {
      errors.push({ type: "syntax", message: "Extractor must be an object" });
      continue;
    }

    if (safeTrim(extractor.id) === "") {
      errors.push({ type: "syntax", message: "Extractor id is required" });
    }
    if (safeTrim(extractor.name) === "") {
      errors.push({ type: "syntax", message: "Extractor name is required" });
    }
    if (safeTrim(extractor.code) === "") {
      errors.push({ type: "syntax", message: "Extractor code is required" });
    }
  }

  return errors;
}

function safeTrim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function checkBracketBalance(code: string, errors: ValidationError[]): void {
  const pairs: readonly [string, string][] = [
    ["(", ")"],
    ["[", "]"],
    ["{", "}"],
  ];

  for (const [open, close] of pairs) {
    const stack: number[] = [];

    for (let i = 0; i < code.length; i++) {
      const ch = code[i];

      if (ch === open) {
        stack.push(i);
      } else if (ch === close) {
        if (stack.length === 0) {
          const line = lineNumber(code, i);
          errors.push({
            type: "syntax",
            message: `Unmatched '${close}' at line ${line}`,
            line,
          });
        } else {
          stack.pop();
        }
      }
    }

    for (const pos of stack) {
      const line = lineNumber(code, pos);
      errors.push({
        type: "syntax",
        message: `Unmatched '${open}' at line ${line}`,
        line,
      });
    }
  }
}

function checkPatterns<T extends { type: string; message: string; line?: number }>(
  code: string,
  patterns: readonly { pattern: RegExp; description: string }[],
  type: T["type"],
  messagePrefix: string,
  out: T[],
): void {
  for (const { pattern, description } of patterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(code)) !== null) {
      const line = lineNumber(code, match.index);
      out.push({ type, message: `${messagePrefix}: ${description} (line ${line})`, line } as T);
    }
  }
}

function checkNavigationPatterns(code: string, errors: ValidationError[]): void {
  checkPatterns(code, NAVIGATION_PATTERNS, "navigation", "Forbidden navigation pattern", errors);
}

function checkSecurityPatterns(code: string, errors: ValidationError[]): void {
  checkPatterns(code, SECURITY_PATTERNS, "security", "Dangerous function", errors);
}

function checkSecurityWarningPatterns(code: string, warnings: ValidationWarning[]): void {
  checkPatterns(
    code,
    SECURITY_WARNING_PATTERNS,
    "security-warning",
    "Potentially risky function",
    warnings,
  );
}

function checkNavigationWarningPatterns(code: string, warnings: ValidationWarning[]): void {
  checkPatterns(
    code,
    NAVIGATION_WARNING_PATTERNS,
    "navigation-warning",
    "Potentially risky navigation",
    warnings,
  );
}

function lineNumber(code: string, index: number): number {
  let count = 1;
  for (let i = 0; i < index; i++) {
    if (code[i] === "\n") count++;
  }
  return count;
}

function sanitizeForValidation(code: string): string {
  let result = "";
  let i = 0;

  while (i < code.length) {
    const ch = code[i];
    const next = code[i + 1];

    if (ch === '"' || ch === "'") {
      const quote = ch;
      const preserveContent = isBracketPropertyLiteral(code, i);
      result += quote;
      i++;

      while (i < code.length) {
        const current = code[i];
        if (current === "\\") {
          result += "  ";
          i += 2;
          continue;
        }
        if (current === quote) {
          result += quote;
          i++;
          break;
        }
        result += preserveContent ? current : current === "\n" ? "\n" : " ";
        i++;
      }
      continue;
    }

    if (ch === "`") {
      result += "`";
      i++;

      while (i < code.length) {
        const current = code[i];
        const following = code[i + 1];

        if (current === "\\") {
          result += "  ";
          i += 2;
          continue;
        }

        if (current === "$" && following === "{") {
          result += "${";
          i += 2;
          const expression = consumeTemplateExpression(code, i);
          result += sanitizeForValidation(expression.content);
          result += "}";
          i = expression.nextIndex;
          continue;
        }

        if (current === "`") {
          result += "`";
          i++;
          break;
        }

        result += current === "\n" ? "\n" : " ";
        i++;
      }
      continue;
    }

    if (ch === "/" && next === "/") {
      result += "  ";
      i += 2;
      while (i < code.length && code[i] !== "\n") {
        result += " ";
        i++;
      }
      continue;
    }

    if (ch === "/" && next === "*") {
      result += "  ";
      i += 2;
      while (i < code.length) {
        const current = code[i];
        const following = code[i + 1];
        if (current === "*" && following === "/") {
          result += "  ";
          i += 2;
          break;
        }
        result += current === "\n" ? "\n" : " ";
        i++;
      }
      continue;
    }

    if (ch === "/" && isRegexLiteralStart(code, i)) {
      result += "/";
      i++;

      while (i < code.length) {
        const current = code[i];
        if (current === "\\") {
          result += "  ";
          i += 2;
          continue;
        }
        if (current === "/") {
          result += "/";
          i++;
          while (i < code.length && /[a-z]/i.test(code[i])) {
            result += " ";
            i++;
          }
          break;
        }
        result += current === "\n" ? "\n" : " ";
        i++;
      }
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}

function isBracketPropertyLiteral(code: string, quoteIndex: number): boolean {
  const previous = previousNonWhitespaceChar(code, quoteIndex - 1);
  if (previous !== "[") {
    return false;
  }

  let i = quoteIndex + 1;
  while (i < code.length) {
    const ch = code[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === code[quoteIndex]) {
      const next = nextNonWhitespaceChar(code, i + 1);
      return next === "]";
    }
    i++;
  }

  return false;
}

function previousNonWhitespaceChar(code: string, startIndex: number): string | null {
  let i = startIndex;
  while (i >= 0) {
    if (!/\s/.test(code[i])) {
      return code[i];
    }
    i--;
  }
  return null;
}

function nextNonWhitespaceChar(code: string, startIndex: number): string | null {
  let i = startIndex;
  while (i < code.length) {
    if (!/\s/.test(code[i])) {
      return code[i];
    }
    i++;
  }
  return null;
}

function isRegexLiteralStart(code: string, index: number): boolean {
  let i = index - 1;
  while (i >= 0 && /\s/.test(code[i])) {
    i--;
  }
  if (i < 0) return true;
  const prev = code[i];
  return /[=({[:,!;?]/.test(prev);
}

function consumeTemplateExpression(
  code: string,
  startIndex: number,
): { content: string; nextIndex: number } {
  let depth = 1;
  let i = startIndex;

  while (i < code.length) {
    const ch = code[i];
    const next = code[i + 1];

    if (ch === "\\") {
      i += 2;
      continue;
    }

    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return {
          content: code.slice(startIndex, i),
          nextIndex: i + 1,
        };
      }
    } else if (ch === '"' || ch === "'" || ch === "`") {
      i = skipQuotedSegment(code, i);
      continue;
    } else if (ch === "/" && next === "/") {
      i = skipLineComment(code, i);
      continue;
    } else if (ch === "/" && next === "*") {
      i = skipBlockComment(code, i);
      continue;
    }

    i++;
  }

  return {
    content: code.slice(startIndex),
    nextIndex: code.length,
  };
}

function skipQuotedSegment(code: string, startIndex: number): number {
  const quote = code[startIndex];
  let i = startIndex + 1;

  while (i < code.length) {
    const ch = code[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === quote) {
      return i + 1;
    }
    i++;
  }

  return code.length;
}

function skipLineComment(code: string, startIndex: number): number {
  let i = startIndex + 2;
  while (i < code.length && code[i] !== "\n") {
    i++;
  }
  return i;
}

function skipBlockComment(code: string, startIndex: number): number {
  let i = startIndex + 2;
  while (i < code.length) {
    if (code[i] === "*" && code[i + 1] === "/") {
      return i + 2;
    }
    i++;
  }
  return code.length;
}
