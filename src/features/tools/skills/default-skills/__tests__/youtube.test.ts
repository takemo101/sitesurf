import { describe, expect, it } from "vitest";
import { youtubeSkill } from "../youtube";

describe("YouTube Skill", () => {
  it("should have correct skill metadata", () => {
    expect(youtubeSkill.id).toBe("youtube");
    expect(youtubeSkill.name).toBe("YouTube Video Operations");
    expect(youtubeSkill.description).toBe("YouTube動画の情報抽出、字幕取得、基本的な操作");
  });

  it("should match YouTube domains", () => {
    expect(youtubeSkill.matchers.hosts).toContain("youtube.com");
    expect(youtubeSkill.matchers.hosts).toContain("youtu.be");
    expect(youtubeSkill.matchers.hosts).toContain("www.youtube.com");
    expect(youtubeSkill.matchers.hosts).toContain("m.youtube.com");
  });

  it("should match watch and shorts paths", () => {
    expect(youtubeSkill.matchers.paths).toContain("/watch");
    expect(youtubeSkill.matchers.paths).toContain("/shorts");
  });

  describe("extractors", () => {
    it("should have getVideoInfo extractor", () => {
      const extractor = youtubeSkill.extractors.find((e) => e.id === "getVideoInfo");
      expect(extractor).toBeDefined();
      expect(extractor?.name).toBe("動画情報取得");
      expect(extractor?.outputSchema).toContain("title");
      expect(extractor?.outputSchema).toContain("channel");
    });

    it("should have getTranscript extractor", () => {
      const extractor = youtubeSkill.extractors.find((e) => e.id === "getTranscript");
      expect(extractor).toBeDefined();
      expect(extractor?.name).toBe("トランスクリプト取得");
      expect(extractor?.outputSchema).toContain("time");
      expect(extractor?.outputSchema).toContain("text");
    });

    it("should have getComments extractor", () => {
      const extractor = youtubeSkill.extractors.find((e) => e.id === "getComments");
      expect(extractor).toBeDefined();
      expect(extractor?.name).toBe("コメント取得");
      expect(extractor?.outputSchema).toContain("author");
      expect(extractor?.outputSchema).toContain("text");
    });

    it("should have valid JavaScript code in all extractors", () => {
      for (const extractor of youtubeSkill.extractors) {
        expect(extractor.code).toBeTruthy();
        expect(extractor.code.length).toBeGreaterThan(0);
        // コードが構文的に正しいかチェック（function式として解析可能か）
        expect(() => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          new Function("return (" + extractor.code + ")");
        }).not.toThrow();
      }
    });
  });
});
