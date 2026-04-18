import { beforeEach, describe, expect, it, vi } from "vitest";
import { FetchProvider } from "../fetch-provider";
import type { ProviderContext } from "@/ports/runtime-provider";
import type { BgFetchMessage, BgFetchResponse } from "@/shared/message-types";

function makeContext(): ProviderContext {
  return {
    browser: {} as ProviderContext["browser"],
    artifactStorage: {} as ProviderContext["artifactStorage"],
  };
}

function stubSendMessage(response: BgFetchResponse) {
  const sendMessage = vi.fn<(msg: BgFetchMessage) => Promise<BgFetchResponse>>(async () => response);
  const runtime = { sendMessage } as unknown as typeof chrome.runtime;
  (globalThis as unknown as { chrome: { runtime: typeof chrome.runtime } }).chrome = { runtime };
  return sendMessage;
}

describe("FetchProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("actions に bgFetch を公開する", () => {
    const provider = new FetchProvider();
    expect(provider.actions).toContain("bgFetch");
  });

  it("getRuntimeCode は bgFetch 関数定義を含む", () => {
    const code = new FetchProvider().getRuntimeCode();
    expect(code).toContain("async function bgFetch(url, options)");
    expect(code).toContain("action: 'bgFetch'");
  });

  it("getDescription は bgFetch の When/Do NOT を含む", () => {
    const description = new FetchProvider().getDescription();
    expect(description).toContain("bgFetch");
    expect(description).toContain("When to Use");
    expect(description).toContain("Do NOT Use For");
  });

  it("url 欠落時は tool_script_error を返す", async () => {
    const provider = new FetchProvider();
    const result = await provider.handleRequest(
      { id: "req-1", action: "bgFetch" },
      makeContext(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("tool_script_error");
    expect(result.error.message).toContain("url");
  });

  it("background に BG_FETCH メッセージをデフォルト値で送る", async () => {
    const send = stubSendMessage({
      success: true,
      data: {
        url: "https://example.com",
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: "hello",
      },
    });

    const provider = new FetchProvider();
    const result = await provider.handleRequest(
      { id: "req-1", action: "bgFetch", url: "https://example.com" },
      makeContext(),
    );

    expect(result.ok).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    const sent = send.mock.calls[0]?.[0] as BgFetchMessage;
    expect(sent.type).toBe("BG_FETCH");
    expect(sent.url).toBe("https://example.com");
    expect(sent.method).toBe("GET");
    expect(sent.responseType).toBe("text");
    expect(sent.timeout).toBe(30_000);
  });

  it("options を正規化して BG_FETCH に反映する", async () => {
    const send = stubSendMessage({
      success: true,
      data: {
        url: "https://api.example.com/users",
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: { id: 1 },
      },
    });

    const provider = new FetchProvider();
    await provider.handleRequest(
      {
        id: "req-2",
        action: "bgFetch",
        url: "https://api.example.com/users",
        method: "POST",
        headers: { authorization: "Bearer x" },
        body: JSON.stringify({ name: "a" }),
        responseType: "json",
        timeout: 999_999, // clamp to max
      },
      makeContext(),
    );

    const sent = send.mock.calls[0]?.[0] as BgFetchMessage;
    expect(sent.method).toBe("POST");
    expect(sent.headers).toEqual({ authorization: "Bearer x" });
    expect(sent.body).toBe(JSON.stringify({ name: "a" }));
    expect(sent.responseType).toBe("json");
    expect(sent.timeout).toBe(60_000); // clamped
  });

  it("不正な responseType は text に fallback する", async () => {
    const send = stubSendMessage({
      success: true,
      data: {
        url: "https://example.com",
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: "hello",
      },
    });

    const provider = new FetchProvider();
    await provider.handleRequest(
      {
        id: "req-3",
        action: "bgFetch",
        url: "https://example.com",
        responseType: "html-invalid",
      },
      makeContext(),
    );

    const sent = send.mock.calls[0]?.[0] as BgFetchMessage;
    expect(sent.responseType).toBe("text");
  });

  it("background が success=false を返したら error に変換する", async () => {
    stubSendMessage({ success: false, error: "Blocked host: localhost" });
    const provider = new FetchProvider();
    const result = await provider.handleRequest(
      { id: "req-4", action: "bgFetch", url: "http://localhost" },
      makeContext(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("tool_script_error");
    expect(result.error.message).toContain("Blocked host");
  });

  it("sendMessage が throw した場合も error にまとめる", async () => {
    const runtime = {
      sendMessage: vi.fn(() => {
        throw new Error("port closed");
      }),
    };
    (globalThis as unknown as { chrome: { runtime: typeof chrome.runtime } }).chrome = {
      runtime: runtime as unknown as typeof chrome.runtime,
    };

    const provider = new FetchProvider();
    const result = await provider.handleRequest(
      { id: "req-5", action: "bgFetch", url: "https://example.com" },
      makeContext(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("port closed");
  });
});
