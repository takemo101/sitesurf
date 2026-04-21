import type { Skill, SkillMatch, DOMSnapshot, DOMIndicators } from "./skill-types";

// パスパターンのワイルドカードマッチング。
// *  は / 以外の任意の文字列にマッチ（単一セグメント）。
// ** は / を含む任意の文字列にマッチ（複数セグメント）。
// ワイルドカードを含まないパターンは startsWith によるプレフィックスマッチ。
const regexCache = new Map<string, RegExp>();

export function matchPath(pathname: string, pattern: string): boolean {
  if (pattern === "") return false;

  if (!pattern.includes("*")) {
    return pathname.startsWith(pattern);
  }

  let regex = regexCache.get(pattern);
  if (!regex) {
    const escaped = pattern.replace(/[.+?^${}()|\\[\]]/g, "\\$&");
    // ** → 任意パス（.*)、* → 単一セグメント（[^/]*）
    // 先に ** を置換してから * を置換する
    const regexStr = escaped
      .replace(/\*\*/g, "<<GLOBSTAR>>")
      .replace(/\*/g, "[^/]*")
      .replace(/<<GLOBSTAR>>/g, ".*");
    regex = new RegExp(`^${regexStr}$`);
    regexCache.set(pattern, regex);
  }
  return regex.test(pathname);
}

export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();

  register(skill: Skill): void {
    this.skills.set(skill.id, skill);
  }

  get(id: string): Skill | undefined {
    return this.skills.get(id);
  }

  getAll(): Skill[] {
    return Array.from(this.skills.values());
  }

  delete(id: string): boolean {
    return this.skills.delete(id);
  }

  getGlobalSkills(): SkillMatch[] {
    return Array.from(this.skills.values())
      .filter((skill) => skill.scope === "global")
      .map((skill) => ({
        skill,
        availableExtractors: skill.extractors,
        confidence: 100,
        // Global skills cover any page, so host alone is never a strong signal.
        // Keep guidance passive until a stronger activation rule is added.
        activationLevel: "passive" as const,
      }));
  }

  getAvailableSkills(url?: string, domSnapshot?: DOMSnapshot, minConfidence = 50): SkillMatch[] {
    const globals = this.getGlobalSkills();
    if (!url) return globals;

    return [...globals, ...this.findMatchingSkills(url, domSnapshot, minConfidence)];
  }

  calculateConfidence(skill: Skill, url: string, domSnapshot?: DOMSnapshot): number {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;
    let score = 0;

    const hostMatch = skill.matchers.hosts.some(
      (pattern) => hostname === pattern || hostname.endsWith(`.${pattern}`),
    );
    if (hostMatch) {
      score += 40;
    }

    if (skill.matchers.paths) {
      const pathMatch = skill.matchers.paths.some((pattern) => matchPath(pathname, pattern));
      if (pathMatch) {
        score += 30;
      }
    } else {
      score += 30;
    }

    if (domSnapshot && skill.metadata?.domIndicators) {
      score += this.calculateDOMScore(skill.metadata.domIndicators, domSnapshot);
    } else if (!skill.metadata?.domIndicators) {
      score += 15;
    }

    return Math.min(score, 100);
  }

  private calculateDOMScore(indicators: DOMIndicators, snapshot: DOMSnapshot): number {
    let domScore = 0;

    if (indicators.selectors.length > 0) {
      const matchedSelectors = indicators.selectors.filter(
        (sel) => (snapshot.elements[sel] ?? 0) > 0,
      );
      const selectorRatio = matchedSelectors.length / indicators.selectors.length;
      domScore += selectorRatio * 20;
    }

    if (indicators.requiredText && indicators.requiredText.length > 0) {
      const matchedTexts = indicators.requiredText.filter((text) =>
        snapshot.texts.some((t) => t.includes(text)),
      );
      const textRatio = matchedTexts.length / indicators.requiredText.length;
      domScore += textRatio * 5;
    }

    if (indicators.minElements !== undefined) {
      const totalElements = Object.values(snapshot.elements).reduce((sum, count) => sum + count, 0);
      if (totalElements >= indicators.minElements) {
        domScore += 5;
      }
    }

    return Math.min(domScore, 30);
  }

  findMatchingSkills(url: string, domSnapshot?: DOMSnapshot, minConfidence = 50): SkillMatch[] {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;

    return Array.from(this.skills.values())
      .filter((skill) => skill.scope !== "global")
      .filter((skill) => {
        const hostMatch = skill.matchers.hosts.some(
          (pattern) => hostname === pattern || hostname.endsWith(`.${pattern}`),
        );
        if (!hostMatch) return false;

        if (skill.matchers.paths) {
          const pathMatch = skill.matchers.paths.some((pattern) => matchPath(pathname, pattern));
          if (!pathMatch) return false;
        }

        return true;
      })
      .map((skill): SkillMatch => {
        // Path-scoped skills narrow the match beyond a broad host, so instruction
        // guidance is task-relevant enough for contextual activation.
        // Host-only skills stay passive to avoid over-firing on unrelated pages
        // (e.g. repo-analysis guidance on a GitHub issue-comment task).
        const pathMatched = skill.matchers.paths !== undefined && skill.matchers.paths.length > 0;
        return {
          skill,
          availableExtractors: skill.extractors,
          confidence: this.calculateConfidence(skill, url, domSnapshot),
          activationLevel: pathMatched ? "contextual" : "passive",
        };
      })
      .filter((match) => match.confidence >= minConfidence)
      .sort((a, b) => b.confidence - a.confidence);
  }
}
