import { describe, expect, it } from "vitest";

import {
  BUILTIN_SKILLS_MANIFEST_PATH,
  getBuiltinSkillFilePath,
  parseAndValidateSkillMarkdown,
} from "../SkillsEditor";

describe("SkillsEditor builtin asset paths", () => {
  it("uses the same absolute manifest path as the runtime skill loader", () => {
    expect(BUILTIN_SKILLS_MANIFEST_PATH).toBe("/skills/skills-manifest.json");
  });

  it("resolves builtin skill markdown paths from the extension root", () => {
    expect(getBuiltinSkillFilePath("youtube.md")).toBe("/skills/youtube.md");
  });

  it("rejects bare extractor bodies in markdown editor validation", () => {
    const result = parseAndValidateSkillMarkdown(`---
id: bare-body-skill
name: Bare Body Skill
description: invalid skill
hosts:
  - example.com
---

## pageTitle
Extract the page title
\`\`\`js
return document.title;
\`\`\`
`);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((error) => error.includes("full function source"))).toBe(true);
  });
});
