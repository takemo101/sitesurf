import { beforeEach, describe, expect, it, vi } from "vitest";

const mockStorageGet = vi.fn();
const MockWebSocket = vi.fn();

vi.stubGlobal("chrome", {
  storage: {
    local: {
      get: mockStorageGet,
    },
  },
});

vi.stubGlobal("WebSocket", MockWebSocket);

describe("wire", () => {
  beforeEach(() => {
    vi.resetModules();
    mockStorageGet.mockReset();
    MockWebSocket.mockReset();
  });

  it("wire モジュールが正常に読み込まれる", async () => {
    const wire = await import("../handlers/wire");
    expect(wire.initWire).toBeTypeOf("function");
    expect(wire.connectWire).toBeTypeOf("function");
    expect(wire.sendPing).toBeTypeOf("function");
  });

  it("enableMcpServer が false の場合は接続しない", async () => {
    mockStorageGet.mockResolvedValue({
      sitesurf_settings: { enableMcpServer: false },
    });

    const wire = await import("../handlers/wire");
    await wire.initWire();

    expect(MockWebSocket).not.toHaveBeenCalled();
  });

  it("設定が存在しない場合は接続しない", async () => {
    mockStorageGet.mockResolvedValue({});

    const wire = await import("../handlers/wire");
    await wire.initWire();

    expect(MockWebSocket).not.toHaveBeenCalled();
  });
});
