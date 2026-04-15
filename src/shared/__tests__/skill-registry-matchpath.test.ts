import { describe, expect, it } from "vitest";
import { matchPath } from "../skill-registry";

describe("matchPath", () => {
  describe("ワイルドカードなし（プレフィックスマッチ）", () => {
    it("完全一致", () => {
      expect(matchPath("/articles", "/articles")).toBe(true);
    });

    it("プレフィックス一致", () => {
      expect(matchPath("/articles/some-slug", "/articles")).toBe(true);
    });

    it("不一致", () => {
      expect(matchPath("/books/slug", "/articles")).toBe(false);
    });
  });

  describe("末尾ワイルドカード", () => {
    it("/articles/* は /articles/some-slug にマッチ", () => {
      expect(matchPath("/articles/some-slug", "/articles/*")).toBe(true);
    });

    it("/articles/* は /articles/ にマッチ", () => {
      expect(matchPath("/articles/", "/articles/*")).toBe(true);
    });

    it("/articles/* は /books/slug にマッチしない", () => {
      expect(matchPath("/books/slug", "/articles/*")).toBe(false);
    });

    it("/articles/* は /articles/slug/sub にマッチしない（完全一致）", () => {
      expect(matchPath("/articles/slug/sub", "/articles/*")).toBe(false);
    });
  });

  describe("中間ワイルドカード", () => {
    it("/users/*/posts は /users/john/posts にマッチ", () => {
      expect(matchPath("/users/john/posts", "/users/*/posts")).toBe(true);
    });

    it("/users/*/posts は /users/john/posts/123 にマッチしない（完全一致）", () => {
      expect(matchPath("/users/john/posts/123", "/users/*/posts")).toBe(false);
    });

    it("/users/*/posts は /users/john/comments にマッチしない", () => {
      expect(matchPath("/users/john/comments", "/users/*/posts")).toBe(false);
    });

    it("* は / をまたがない", () => {
      expect(matchPath("/users/a/b/posts", "/users/*/posts")).toBe(false);
    });
  });

  describe("複数ワイルドカード", () => {
    it("/a/*/b/*/c は /a/x/b/y/c にマッチ", () => {
      expect(matchPath("/a/x/b/y/c", "/a/*/b/*/c")).toBe(true);
    });

    it("/a/*/b/*/c は /a/x/b/y/d にマッチしない", () => {
      expect(matchPath("/a/x/b/y/d", "/a/*/b/*/c")).toBe(false);
    });
  });

  describe("拡張子付きワイルドカード", () => {
    it("/data/*.json は /data/file.json にマッチ", () => {
      expect(matchPath("/data/file.json", "/data/*.json")).toBe(true);
    });

    it("/data/*.json は /data/file.xml にマッチしない", () => {
      expect(matchPath("/data/file.xml", "/data/*.json")).toBe(false);
    });

    it("/data/*.json は /data/file.json.bak にマッチしない（完全一致）", () => {
      expect(matchPath("/data/file.json.bak", "/data/*.json")).toBe(false);
    });
  });

  describe("特殊文字のエスケープ", () => {
    it("パターン内のドットがリテラルとして扱われる", () => {
      expect(matchPath("/api/v1.0/users", "/api/v1.0/*")).toBe(true);
      expect(matchPath("/api/v1X0/users", "/api/v1.0/*")).toBe(false);
    });
  });

  describe("ダブルワイルドカード（**）", () => {
    it("/articles/** は /articles/slug にマッチ", () => {
      expect(matchPath("/articles/slug", "/articles/**")).toBe(true);
    });

    it("/articles/** は /articles/slug/edit にマッチ", () => {
      expect(matchPath("/articles/slug/edit", "/articles/**")).toBe(true);
    });

    it("/articles/** は /articles/a/b/c にマッチ", () => {
      expect(matchPath("/articles/a/b/c", "/articles/**")).toBe(true);
    });

    it("/articles/** は /books/slug にマッチしない", () => {
      expect(matchPath("/books/slug", "/articles/**")).toBe(false);
    });

    it("/**/settings は /user/settings にマッチ", () => {
      expect(matchPath("/user/settings", "/**/settings")).toBe(true);
    });

    it("/**/settings は /a/b/settings にマッチ", () => {
      expect(matchPath("/a/b/settings", "/**/settings")).toBe(true);
    });

    it("/api/**/detail は /api/v1/users/detail にマッチ", () => {
      expect(matchPath("/api/v1/users/detail", "/api/**/detail")).toBe(true);
    });

    it("** と * の混在: /a/*/b/** は /a/x/b/c/d にマッチ", () => {
      expect(matchPath("/a/x/b/c/d", "/a/*/b/**")).toBe(true);
    });

    it("** と * の混在: /a/*/b/** は /a/x/y/b/c にマッチしない", () => {
      expect(matchPath("/a/x/y/b/c", "/a/*/b/**")).toBe(false);
    });
  });

  describe("エッジケース", () => {
    it("空パターンはマッチしない", () => {
      expect(matchPath("/anything", "")).toBe(false);
    });

    it("空パス名に対するテスト", () => {
      expect(matchPath("", "/articles")).toBe(false);
      expect(matchPath("", "/articles/*")).toBe(false);
    });

    it("bare * は単一セグメントのみマッチ", () => {
      expect(matchPath("foo", "*")).toBe(true);
      expect(matchPath("/foo", "*")).toBe(false);
    });

    it("先頭 / なしのパターンはパス名にマッチしにくい", () => {
      expect(matchPath("/articles/slug", "articles/*")).toBe(false);
    });

    it("末尾スラッシュ付きパターン", () => {
      expect(matchPath("/articles/slug/", "/articles/*/")).toBe(true);
      expect(matchPath("/articles/slug", "/articles/*/")).toBe(false);
    });
  });
});
