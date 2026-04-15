import { describe, expect, it } from "vitest";

import { validateSkillCode } from "../validator";

describe("validateSkillCode", () => {
  describe("有効なコード", () => {
    it("安全なコードはvalidを返す", () => {
      const code = `const title = document.querySelector("h1")?.textContent?.trim();
return { title };`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("複雑だが安全なコードはvalidを返す", () => {
      const code = `const items = Array.from(document.querySelectorAll(".item"));
const results = items.map((el) => {
  const text = el.textContent?.trim() ?? "";
  return { text, href: el.getAttribute("href") };
});
return results.filter((r) => r.text.length > 0);`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("構文検証 (syntax)", () => {
    it("対応する閉じ括弧がない場合にエラー", () => {
      const code = `function foo() {
  const arr = [1, 2;
  return arr;
}`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "syntax",
            message: expect.stringContaining("Unmatched"),
          }),
        ]),
      );
    });

    it("余分な閉じ括弧がある場合にエラー", () => {
      const code = `const x = 1);
return x;`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "syntax",
            message: expect.stringContaining("Unmatched ')"),
          }),
        ]),
      );
    });

    it("複数の不一致がある場合、全てのエラーを報告する", () => {
      const code = `const x = (1;
const y = [2;
return { x, y };`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      const syntaxErrors = result.errors.filter((e) => e.type === "syntax");
      expect(syntaxErrors.length).toBeGreaterThanOrEqual(2);
    });

    it("正しくバランスした括弧はエラーなし", () => {
      const code = `const fn = () => {
  const arr = [1, 2, 3];
  const obj = { key: "value" };
  return fn(arr, obj);
};`;
      const result = validateSkillCode(code);

      const syntaxErrors = result.errors.filter((e) => e.type === "syntax");
      expect(syntaxErrors).toHaveLength(0);
    });

    it("括弧の行番号を正しく報告する", () => {
      const code = `const a = 1;
const b = (2;
return b;`;
      const result = validateSkillCode(code);

      const syntaxErrors = result.errors.filter((e) => e.type === "syntax");
      expect(syntaxErrors).toHaveLength(1);
      expect(syntaxErrors[0].line).toBe(2);
    });
  });

  describe("ナビゲーション検出 (navigation)", () => {
    it("window.location = を検出する", () => {
      const code = `window.location = "https://example.com";
return "navigated";`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "navigation",
            message: expect.stringContaining("window.location assignment"),
          }),
        ]),
      );
    });

    it("window.location.href = を検出する", () => {
      const code = `window.location.href = "https://example.com";`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "navigation",
            message: expect.stringContaining("window.location.href assignment"),
          }),
        ]),
      );
    });

    it("window.location.assign() を検出する", () => {
      const code = `window.location.assign("https://example.com");`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "navigation",
            message: expect.stringContaining("window.location.assign()"),
          }),
        ]),
      );
    });

    it("window.location.replace() を検出する", () => {
      const code = `window.location.replace("https://example.com");`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "navigation",
            message: expect.stringContaining("window.location.replace()"),
          }),
        ]),
      );
    });

    it("window.location.reload() を検出する", () => {
      const code = `window.location.reload();`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "navigation",
            message: expect.stringContaining("window.location.reload()"),
          }),
        ]),
      );
    });

    it("location.assign() を検出する", () => {
      const code = `location.assign("https://example.com");`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "navigation",
            message: expect.stringContaining("location.assign()"),
          }),
        ]),
      );
    });

    it("location.replace() を検出する", () => {
      const code = `location.replace("https://example.com");`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "navigation",
            message: expect.stringContaining("location.replace()"),
          }),
        ]),
      );
    });

    it("window.location.pathname = を検出する", () => {
      const code = `window.location.pathname = "/next";`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "navigation",
            message: expect.stringContaining("window.location.pathname assignment"),
          }),
        ]),
      );
    });

    it("document.location.href = を検出する", () => {
      const code = `document.location.href = "https://example.com";`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "navigation",
            message: expect.stringContaining("document.location.href assignment"),
          }),
        ]),
      );
    });

    it("document.location.pathname = を検出する", () => {
      const code = `document.location.pathname = "/next";`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "navigation",
            message: expect.stringContaining("document.location.pathname assignment"),
          }),
        ]),
      );
    });

    it("document.location.assign() を検出する", () => {
      const code = `document.location.assign("https://example.com");`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "navigation",
            message: expect.stringContaining("document.location.assign()"),
          }),
        ]),
      );
    });

    it("document.location.replace() を検出する", () => {
      const code = `document.location.replace("https://example.com");`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "navigation",
            message: expect.stringContaining("document.location.replace()"),
          }),
        ]),
      );
    });

    it("document.location.reload() を検出する", () => {
      const code = `document.location.reload();`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "navigation",
            message: expect.stringContaining("document.location.reload()"),
          }),
        ]),
      );
    });

    it("location = を検出する", () => {
      const code = `location = "https://example.com";`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "navigation",
            message: expect.stringContaining("location assignment"),
          }),
        ]),
      );
    });

    it("location.href = を検出する", () => {
      const code = `location.href = "https://example.com";`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "navigation",
            message: expect.stringContaining("location.href assignment"),
          }),
        ]),
      );
    });

    it("location.pathname = を検出する", () => {
      const code = `location.pathname = "/next";`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "navigation",
            message: expect.stringContaining("location.pathname assignment"),
          }),
        ]),
      );
    });

    it("navigate() を警告として検出する", () => {
      const code = `navigate("/new-path");`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "navigation-warning",
            message: expect.stringContaining("navigate()"),
          }),
        ]),
      );
    });

    it("history.pushState() を検出する", () => {
      const code = `history.pushState({}, "", "/new-url");`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "navigation",
            message: expect.stringContaining("history.pushState()"),
          }),
        ]),
      );
    });

    it("history.replaceState() を検出する", () => {
      const code = `history.replaceState({}, "", "/new-url");`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "navigation",
            message: expect.stringContaining("history.replaceState()"),
          }),
        ]),
      );
    });

    it("window.locationの読み取りは許可する", () => {
      const code = `const url = window.location.href;
const host = window.location.hostname;
return { url, host };`;
      const result = validateSkillCode(code);

      const navErrors = result.errors.filter((e) => e.type === "navigation");
      expect(navErrors).toHaveLength(0);
    });

    it("locationを含む変数名を誤検出しない", () => {
      const code = `const currentLocation = "here";
return currentLocation;`;
      const result = validateSkillCode(code);

      const navErrors = result.errors.filter((e) => e.type === "navigation");
      expect(navErrors).toHaveLength(0);
    });

    it("文字列中の navigation パターンを誤検出しない", () => {
      const code = `const message = "window.location = https://example.com";
return message;`;
      const result = validateSkillCode(code);

      const navErrors = result.errors.filter((e) => e.type === "navigation");
      expect(navErrors).toHaveLength(0);
    });

    it("regex literal 中の navigation パターンを誤検出しない", () => {
      const code = String.raw`const re = /location\.assign\(/;
return re.test(input);`;
      const result = validateSkillCode(code);

      const navErrors = result.errors.filter((e) => e.type === "navigation");
      expect(navErrors).toHaveLength(0);
    });

    it("return 文脈の regex literal 中の navigation パターンを誤検出しない", () => {
      const code = String.raw`return /location\.assign\(/.test(input);`;
      const result = validateSkillCode(code);

      const navErrors = result.errors.filter((e) => e.type === "navigation");
      expect(navErrors).toHaveLength(0);
    });

    it("arrow function 文脈の regex literal 中の navigation パターンを誤検出しない", () => {
      const code = String.raw`const test = () => /location\.assign\(/.test(input);`;
      const result = validateSkillCode(code);

      const navErrors = result.errors.filter((e) => e.type === "navigation");
      expect(navErrors).toHaveLength(0);
    });

    it("除算の後に続く navigation パターンを見逃さない", () => {
      const code = `const ratio = total / count;
location.assign("https://example.com");`;
      const result = validateSkillCode(code);

      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "navigation",
            message: expect.stringContaining("location.assign()"),
          }),
        ]),
      );
    });

    it("bracket notation の location.assign を検出する", () => {
      const code = 'window["location"]["assign"]("https://example.com");';
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors.some((error) => error.type === "navigation")).toBe(true);
    });

    it("top.location.href への代入を検出する", () => {
      const code = 'top.location.href = "https://example.com";';
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors.some((error) => error.type === "navigation")).toBe(true);
    });

    it("self.location への代入を検出する", () => {
      const code = 'self.location = "https://example.com";';
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors.some((error) => error.type === "navigation")).toBe(true);
    });

    it("top.location への代入を検出する", () => {
      const code = 'top.location = "https://example.com";';
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors.some((error) => error.type === "navigation")).toBe(true);
    });

    it("globalThis.location への代入を検出する", () => {
      const code = 'globalThis.location = "https://example.com";';
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors.some((error) => error.type === "navigation")).toBe(true);
    });

    it('window["location"] への代入を検出する', () => {
      const code = 'window["location"] = "https://example.com";';
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors.some((error) => error.type === "navigation")).toBe(true);
    });
  });

  describe("セキュリティスキャン (security)", () => {
    it("eval() を検出する", () => {
      const code = `eval("alert(1)");`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "security",
            message: expect.stringContaining("eval()"),
          }),
        ]),
      );
    });

    it("new Function() を検出する", () => {
      const code = `new Function("return 1")();`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "security",
            message: expect.stringContaining("new Function()"),
          }),
        ]),
      );
    });

    it("Function() を検出する", () => {
      const code = `const fn = Function("return 1");
return fn();`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "security",
            message: expect.stringContaining("Function()"),
          }),
        ]),
      );
    });

    it("setTimeout with string を検出する", () => {
      const code = `setTimeout("alert(1)", 1000);`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "security",
            message: expect.stringContaining("setTimeout with string argument"),
          }),
        ]),
      );
    });

    it("setTimeout with functionは許可する", () => {
      const code = `setTimeout(() => { console.log("ok"); }, 1000);`;
      const result = validateSkillCode(code);

      const secErrors = result.errors.filter((e) => e.type === "security");
      expect(secErrors).toHaveLength(0);
    });

    it("setInterval with string を検出する", () => {
      const code = `setInterval("alert(1)", 1000);`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "security",
            message: expect.stringContaining("setInterval with string argument"),
          }),
        ]),
      );
    });

    it("document.write() を検出する", () => {
      const code = `document.write("<h1>Hello</h1>");`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "security",
            message: expect.stringContaining("document.write()"),
          }),
        ]),
      );
    });

    it('document["write"]() を検出する', () => {
      const code = 'document["write"]("<h1>Hello</h1>");';
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors.some((error) => error.type === "security")).toBe(true);
    });

    it("fetch() を警告として検出する", () => {
      const code = `return fetch("https://example.com");`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "security-warning",
            message: expect.stringContaining("fetch()"),
          }),
        ]),
      );
    });

    it("navigator.sendBeacon() を警告として検出する", () => {
      const code = `navigator.sendBeacon("https://example.com", "payload");`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "security-warning",
            message: expect.stringContaining("navigator.sendBeacon()"),
          }),
        ]),
      );
    });

    it('navigator["sendBeacon"]() を警告として検出する', () => {
      const code = 'navigator["sendBeacon"]("https://example.com", "payload");';
      const result = validateSkillCode(code);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.type === "security-warning")).toBe(true);
    });

    it("new XMLHttpRequest() を警告として検出する", () => {
      const code = `const xhr = new XMLHttpRequest();
xhr.open("GET", "https://example.com");`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "security-warning",
            message: expect.stringContaining("new XMLHttpRequest()"),
          }),
        ]),
      );
    });

    it("new WebSocket() を警告として検出する", () => {
      const code = `const socket = new WebSocket("wss://example.com");`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(true);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "security-warning",
            message: expect.stringContaining("new WebSocket()"),
          }),
        ]),
      );
    });

    it("new Image() を検出する", () => {
      const code = `const image = new Image();
image.src = "https://example.com/pixel";`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "security",
            message: expect.stringContaining("new Image()"),
          }),
        ]),
      );
    });

    it("form.submit() を検出する", () => {
      const code = `const form = document.querySelector("form");
form?.submit();`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "security",
            message: expect.stringContaining("form.submit()"),
          }),
        ]),
      );
    });

    it("evalを含む変数名を誤検出しない", () => {
      const code = `const evaluate = (x) => x + 1;
return evaluate(5);`;
      const result = validateSkillCode(code);

      const secErrors = result.errors.filter((e) => e.type === "security");
      expect(secErrors).toHaveLength(0);
    });

    it("文字列中の security パターンを誤検出しない", () => {
      const code = `const text = "eval(alert(1))";
return text;`;
      const result = validateSkillCode(code);

      const secErrors = result.errors.filter((e) => e.type === "security");
      expect(secErrors).toHaveLength(0);
    });

    it("regex literal 中の security パターンを誤検出しない", () => {
      const code = String.raw`const re = /eval\(/;
return re.test(input);`;
      const result = validateSkillCode(code);

      const secErrors = result.errors.filter((e) => e.type === "security");
      expect(secErrors).toHaveLength(0);
    });

    it("return 文脈の regex literal 中の security パターンを誤検出しない", () => {
      const code = String.raw`return /eval\(/.test(input);`;
      const result = validateSkillCode(code);

      const secErrors = result.errors.filter((e) => e.type === "security");
      expect(secErrors).toHaveLength(0);
    });

    it("arrow function 文脈の regex literal 中の security パターンを誤検出しない", () => {
      const code = String.raw`const test = () => /eval\(/.test(input);`;
      const result = validateSkillCode(code);

      const secErrors = result.errors.filter((e) => e.type === "security");
      expect(secErrors).toHaveLength(0);
    });

    it("除算の後に続く security パターンを見逃さない", () => {
      const code = `const ratio = total / count;
eval("alert(1)");`;
      const result = validateSkillCode(code);

      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "security",
            message: expect.stringContaining("eval()"),
          }),
        ]),
      );
    });

    it("template literal 補間内の禁止コードを検出する", () => {
      const code = 'const text = `${location.assign("https://example.com")}`;\nreturn text;';
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "navigation",
            message: expect.stringContaining("location.assign()"),
          }),
        ]),
      );
    });

    it("globalThis.fetch を警告として検出する", () => {
      const code = 'return globalThis.fetch("https://example.com");';
      const result = validateSkillCode(code);

      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.type === "security-warning")).toBe(true);
    });

    it("indirect eval を検出する", () => {
      const code = '(0, eval)("alert(1)");';
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors.some((error) => error.type === "security")).toBe(true);
    });

    it("constructor chain 経由の Function 呼び出しを検出する", () => {
      const code = 'return [].constructor.constructor("return 1")();';
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors.some((error) => error.type === "security")).toBe(true);
    });
  });

  describe("複合パターン", () => {
    it("複数のエラータイプを同時に報告する", () => {
      const code = `const x = (1;
eval("code");
window.location = "https://evil.com";
return x;`;
      const result = validateSkillCode(code);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.type === "syntax")).toBe(true);
      expect(result.errors.some((e) => e.type === "security")).toBe(true);
      expect(result.errors.some((e) => e.type === "navigation")).toBe(true);
    });

    it("空のコードはvalidを返す", () => {
      const result = validateSkillCode("");

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("文字列中の括弧を構文エラー扱いしない", () => {
      const code = `const text = ")";
return text;`;
      const result = validateSkillCode(code);

      const syntaxErrors = result.errors.filter((e) => e.type === "syntax");
      expect(syntaxErrors).toHaveLength(0);
    });
  });
});
