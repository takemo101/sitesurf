import { describe, expect, it } from "vitest";
import { getManualChunk } from "../../../vite.config";

describe("getManualChunk", () => {
  it("eager に使う chat / settings / artifacts state は core に残す", () => {
    expect(getManualChunk("/repo/src/features/chat/InputArea.tsx")).toBe("core");
    expect(getManualChunk("/repo/src/features/chat/chat-store.ts")).toBe("core");
    expect(getManualChunk("/repo/src/features/settings/settings-store.ts")).toBe("core");
    expect(getManualChunk("/repo/src/features/artifacts/artifact-slice.ts")).toBe("core");
  });

  it("lazy UI だけを feature chunk に分ける", () => {
    expect(getManualChunk("/repo/src/features/settings/SettingsPanel.tsx")).toBe("settings");
    expect(getManualChunk("/repo/src/features/artifacts/ArtifactPanel.tsx")).toBe("artifacts");
  });

  it("ChatArea は明示チャンク割り当てなし（Rolldown に委ねて lazy-load 対象にする）", () => {
    expect(getManualChunk("/repo/src/features/chat/ChatArea.tsx")).toBeUndefined();
  });

  it("background の動的 import 対象は bg-tools に分離する", () => {
    expect(getManualChunk("/repo/src/adapters/chrome/chrome-browser-executor.ts")).toBe("bg-tools");
    expect(getManualChunk("/repo/src/features/tools/inspect.ts")).toBe("bg-tools");
  });

  it("shared / ports は shared chunk に分離する", () => {
    expect(getManualChunk("/repo/src/shared/errors.ts")).toBe("shared");
    expect(getManualChunk("/repo/src/shared/logger.ts")).toBe("shared");
    expect(getManualChunk("/repo/src/ports/browser-executor.ts")).toBe("shared");
  });
});
