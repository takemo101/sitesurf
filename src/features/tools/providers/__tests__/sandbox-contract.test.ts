import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ArtifactProvider,
  BrowserJsProvider,
  FetchProvider,
  NativeInputProvider,
  NavigateProvider,
  ReadPageProvider,
} from "..";

/**
 * sandbox.html と provider の action / helper 名が drift していないことを担保する。
 *
 * 背景: 当初 RuntimeProvider.getRuntimeCode() で sandbox にコードを注入する設計だったが、
 * 実際には呼ばれない dead code になっており、実体は public/sandbox.html の hardcode。
 * そのため provider 側に action を追加しても sandbox.html を更新し忘れると
 * "xxx is not defined" で failure する (例: ADR-007 で saveArtifact → PR #147 で修正)。
 *
 * 本テストは 3 観点で drift を検出する:
 *  1. provider.actions の全 action が sandbox.html 内で sendToParent("<action>", ...) として emit される
 *  2. sandbox.html の AsyncFunction 引数名と実際の関数定義が一致する
 *  3. 既知の全 helper (各 provider の action に対応するもの) が AsyncFunction 引数に列挙されている
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const SANDBOX_HTML_PATH = join(__dirname, "..", "..", "..", "..", "..", "public", "sandbox.html");
const sandboxHtml = readFileSync(SANDBOX_HTML_PATH, "utf-8");

function extractSendToParentActions(html: string): Set<string> {
  const actions = new Set<string>();
  const regex = /sendToParent\s*\(\s*["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    actions.add(match[1]);
  }
  return actions;
}

function extractAsyncFunctionArgNames(html: string): string[] {
  // `new AsyncFunction(` から始まり `msg.code,\n)` で閉じるブロックを抽出
  const start = html.indexOf("new AsyncFunction(");
  if (start === -1) throw new Error("new AsyncFunction not found in sandbox.html");
  const afterOpen = html.indexOf("(", start) + 1;
  const closeIdx = html.indexOf("msg.code", afterOpen);
  if (closeIdx === -1) throw new Error("msg.code marker not found");
  const slice = html.substring(afterOpen, closeIdx);
  // 引数名は "foo" の形で並んでいる
  return Array.from(slice.matchAll(/"([^"]+)"/g)).map((m) => m[1]);
}

function extractAsyncFunctionCallNames(html: string): string[] {
  // `const result = await fn(` から ` );` が現れるまでを抽出
  const start = html.indexOf("await fn(");
  if (start === -1) throw new Error("await fn( not found in sandbox.html");
  const open = html.indexOf("(", start) + 1;
  let depth = 1;
  let i = open;
  while (i < html.length && depth > 0) {
    const ch = html[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    if (depth === 0) break;
    i += 1;
  }
  const slice = html.substring(open, i);
  return slice
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function extractTopLevelFunctionDefs(html: string): Set<string> {
  const names = new Set<string>();
  const regex = /^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    names.add(match[1]);
  }
  return names;
}

describe("sandbox.html contract", () => {
  const providers = [
    { name: "BrowserJsProvider", provider: new BrowserJsProvider() },
    { name: "NavigateProvider", provider: new NavigateProvider() },
    { name: "ReadPageProvider", provider: new ReadPageProvider() },
    { name: "FetchProvider", provider: new FetchProvider() },
    { name: "NativeInputProvider", provider: new NativeInputProvider() },
    { name: "ArtifactProvider", provider: new ArtifactProvider() },
  ];

  describe("provider.actions ↔ sandbox sendToParent() の対応", () => {
    const emitted = extractSendToParentActions(sandboxHtml);

    for (const { name, provider } of providers) {
      // Artifact provider は deprecated wire action (createOrUpdateArtifact, returnFile) も
      // 受理するが、sandbox 側は新 action しか emit しないのでスキップする
      const emittedRequired =
        name === "ArtifactProvider"
          ? provider.actions.filter(
              (a) => !["createOrUpdateArtifact", "returnFile"].includes(a),
            )
          : provider.actions;

      it(`${name}: 宣言された action を sandbox から emit できる`, () => {
        for (const action of emittedRequired) {
          expect(
            emitted.has(action),
            `sandbox.html が sendToParent("${action}", ...) を呼んでいません (${name})`,
          ).toBe(true);
        }
      });
    }

    it("sandbox が emit する action はすべて何らかの provider に登録されている", () => {
      const registered = new Set<string>();
      for (const { provider } of providers) {
        for (const a of provider.actions) registered.add(a);
      }
      for (const action of emitted) {
        expect(
          registered.has(action),
          `sandbox.html が sendToParent("${action}", ...) を呼ぶがどの provider にも登録されていない`,
        ).toBe(true);
      }
    });
  });

  describe("AsyncFunction の引数と関数定義の整合", () => {
    const argNames = extractAsyncFunctionArgNames(sandboxHtml);
    const callNames = extractAsyncFunctionCallNames(sandboxHtml);
    const defined = extractTopLevelFunctionDefs(sandboxHtml);

    it("AsyncFunction の引数リストと fn() の呼び出し引数が一致する", () => {
      expect(callNames).toEqual(argNames);
    });

    it("各引数名に対応する top-level 関数定義がある (skills / console を除く)", () => {
      for (const arg of argNames) {
        if (arg === "skills" || arg === "console") continue;
        expect(
          defined.has(arg),
          `sandbox.html に async function ${arg}() の定義がありません (AsyncFunction の bind 失敗 → REPL で "is not defined" になります)`,
        ).toBe(true);
      }
    });

    it("全 provider の helper (action 名 = 関数名) が AsyncFunction で bind されている", () => {
      const bound = new Set(argNames);
      for (const { name, provider } of providers) {
        for (const action of provider.actions) {
          // BrowserJsProvider / NavigateProvider / ReadPageProvider / FetchProvider:
          //   action 名 = REPL 内での関数名
          // NativeInputProvider: action 名 = 関数名
          // ArtifactProvider: saveArtifact, getArtifact, listArtifacts, deleteArtifact,
          //   createOrUpdateArtifact (deprecated wrapper), returnFile (deprecated wrapper)
          expect(
            bound.has(action),
            `action "${action}" が sandbox.html の AsyncFunction 引数に含まれていません (${name})`,
          ).toBe(true);
        }
      }
    });
  });
});
