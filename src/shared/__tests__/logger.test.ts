import { describe, expect, it, vi } from "vitest";
import { createLogger } from "../logger";

describe("createLogger", () => {
  it("プレフィックス付きで debug を出力する", () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const log = createLogger("test-module");
    log.debug("hello", { key: "value" });
    expect(spy).toHaveBeenCalledWith("[SiteSurf:test-module]", "hello", { key: "value" });
    spy.mockRestore();
  });

  it("プレフィックス付きで info を出力する", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const log = createLogger("test-module");
    log.info("started");
    expect(spy).toHaveBeenCalledWith("[SiteSurf:test-module]", "started", "");
    spy.mockRestore();
  });

  it("プレフィックス付きで warn を出力する", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = createLogger("test-module");
    log.warn("caution", 42);
    expect(spy).toHaveBeenCalledWith("[SiteSurf:test-module]", "caution", 42);
    spy.mockRestore();
  });

  it("プレフィックス付きで error を出力する", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = createLogger("test-module");
    const err = new Error("fail");
    log.error("broken", err);
    expect(spy).toHaveBeenCalledWith("[SiteSurf:test-module]", "broken", err);
    spy.mockRestore();
  });

  it("data 省略時は空文字列を渡す", () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const log = createLogger("mod");
    log.debug("msg");
    expect(spy).toHaveBeenCalledWith("[SiteSurf:mod]", "msg", "");
    spy.mockRestore();
  });

  it("モジュール名ごとに異なるプレフィックスが付く", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const logA = createLogger("alpha");
    const logB = createLogger("beta");
    logA.info("a");
    logB.info("b");
    expect(spy).toHaveBeenCalledWith("[SiteSurf:alpha]", "a", "");
    expect(spy).toHaveBeenCalledWith("[SiteSurf:beta]", "b", "");
    spy.mockRestore();
  });
});
