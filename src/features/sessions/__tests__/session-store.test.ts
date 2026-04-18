import { describe, expect, it, vi, beforeEach } from "vitest";

import type { SessionStoragePort } from "@/ports/session-storage";
import type { Session, SessionMeta } from "@/ports/session-types";

import type { SessionStoreDeps } from "../types";
import {
  loadSessionList,
  createSession,
  switchSession,
  deleteSession,
  renameSession,
  generateTitle,
} from "../session-store";

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "sess-1",
    title: "テスト",
    createdAt: "2025-01-01T00:00:00.000Z",
    model: "claude-sonnet-4-20250514",
    messages: [],
    history: [],
    ...overrides,
  };
}

function makeMeta(overrides: Partial<SessionMeta> = {}): SessionMeta {
  return {
    id: "sess-1",
    title: "テスト",
    createdAt: "2025-01-01T00:00:00.000Z",
    lastModified: "2025-01-01T00:00:00.000Z",
    messageCount: 0,
    modelId: "claude-sonnet-4-20250514",
    preview: "",
    ...overrides,
  };
}

function makeMockStorage(): SessionStoragePort {
  return {
    listSessions: vi.fn().mockResolvedValue([]),
    getMetadata: vi.fn().mockResolvedValue(null),
    getLatestSessionId: vi.fn().mockResolvedValue(null),
    getSession: vi.fn().mockResolvedValue(null),
    saveSession: vi.fn().mockResolvedValue(undefined),
    updateTitle: vi.fn().mockResolvedValue(undefined),
    deleteSession: vi.fn().mockResolvedValue(undefined),
  };
}

function makeDeps(overrides: Partial<SessionStoreDeps> = {}): SessionStoreDeps {
  return {
    sessionStorage: makeMockStorage(),
    acquireLock: vi.fn().mockResolvedValue({ success: true }),
    releaseLock: vi.fn().mockResolvedValue(undefined),
    getSessionLocks: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

function makeStore() {
  return {
    setSessionList: vi.fn(),
    setArtifactSessionId: vi.fn(),
    loadSession: vi.fn(),
    setSessionLoading: vi.fn(),
    clearAll: vi.fn(),
  };
}

describe("session-store", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  describe("loadSessionList", () => {
    it("sessionStorage からメタ一覧を読み込み store に設定する", async () => {
      const metaList = [makeMeta()];
      const deps = makeDeps();
      (deps.sessionStorage.listSessions as ReturnType<typeof vi.fn>).mockResolvedValue(metaList);
      const store = makeStore();

      await loadSessionList(deps, store);

      expect(store.setSessionList).toHaveBeenCalledWith(metaList);
    });
  });

  describe("createSession", () => {
    it("新規セッションを作成して保存し store にロードする", async () => {
      const deps = makeDeps();
      const store = makeStore();

      const id = await createSession(deps, store, "claude-sonnet-4-20250514");

      expect(id).toBeTruthy();
      expect(deps.sessionStorage.saveSession).toHaveBeenCalledTimes(1);
      expect(store.loadSession).toHaveBeenCalledTimes(1);

      const savedSession = (deps.sessionStorage.saveSession as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(savedSession.id).toBe(id);
      expect(savedSession.title).toBe("新しい会話");
      expect(savedSession.model).toBe("claude-sonnet-4-20250514");
    });

    it("作成後にセッション一覧を再読込する", async () => {
      const deps = makeDeps();
      const store = makeStore();

      await createSession(deps, store, "gpt-4o");

      expect(deps.sessionStorage.listSessions).toHaveBeenCalled();
      expect(store.setSessionList).toHaveBeenCalled();
    });
  });

  describe("switchSession", () => {
    it("ロック取得後にセッションを読み込む", async () => {
      const session = makeSession();
      const deps = makeDeps();
      (deps.sessionStorage.getSession as ReturnType<typeof vi.fn>).mockResolvedValue(session);
      const store = makeStore();

      await switchSession(deps, store, "sess-1");

      expect(deps.acquireLock).toHaveBeenCalledWith("sess-1");
      expect(store.loadSession).toHaveBeenCalledWith(session);
    });

    it("ロック取得失敗時はエラーを投げる", async () => {
      const deps = makeDeps({
        acquireLock: vi.fn().mockResolvedValue({ success: false }),
      });
      const store = makeStore();

      await expect(switchSession(deps, store, "sess-1")).rejects.toThrow("別のウィンドウで使用中");
    });

    it("セッションが見つからない場合はエラーを投げる", async () => {
      const deps = makeDeps();
      (deps.sessionStorage.getSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const store = makeStore();

      await expect(switchSession(deps, store, "not-found")).rejects.toThrow("見つかりません");
    });

    it("setSessionLoading が前後で呼ばれる", async () => {
      const session = makeSession();
      const deps = makeDeps();
      (deps.sessionStorage.getSession as ReturnType<typeof vi.fn>).mockResolvedValue(session);
      const store = makeStore();

      await switchSession(deps, store, "sess-1");

      expect(store.setSessionLoading).toHaveBeenCalledWith(true);
      expect(store.setSessionLoading).toHaveBeenCalledWith(false);
    });

    it("エラー時も setSessionLoading(false) が呼ばれる", async () => {
      const deps = makeDeps({
        acquireLock: vi.fn().mockRejectedValue(new Error("network")),
      });
      const store = makeStore();

      await expect(switchSession(deps, store, "sess-1")).rejects.toThrow();
      expect(store.setSessionLoading).toHaveBeenCalledWith(false);
    });
  });

  describe("deleteSession", () => {
    it("セッションを削除して一覧を更新する", async () => {
      const deps = makeDeps();
      const store = makeStore();

      await deleteSession(deps, store, "sess-2", "sess-1");

      expect(deps.sessionStorage.deleteSession).toHaveBeenCalledWith("sess-2");
      expect(deps.sessionStorage.listSessions).toHaveBeenCalled();
    });

    it("使用中のセッションは削除できない", async () => {
      const deps = makeDeps();
      const store = makeStore();

      await expect(deleteSession(deps, store, "sess-1", "sess-1")).rejects.toThrow(
        "使用中のセッションは削除できません",
      );
    });
  });

  describe("renameSession", () => {
    it("タイトルを更新して一覧を再読込する", async () => {
      const deps = makeDeps();
      const store = makeStore();

      await renameSession(deps, store, "sess-1", "新タイトル", null);

      expect(deps.sessionStorage.updateTitle).toHaveBeenCalledWith("sess-1", "新タイトル");
      expect(deps.sessionStorage.listSessions).toHaveBeenCalled();
    });

    it("アクティブセッションのリネーム時は snapshot も更新する", async () => {
      const deps = makeDeps();
      const store = makeStore();
      const snapshot = makeSession({ id: "sess-1" });

      await renameSession(deps, store, "sess-1", "新タイトル", snapshot);

      expect(store.loadSession).toHaveBeenCalledWith(
        expect.objectContaining({ id: "sess-1", title: "新タイトル" }),
      );
    });
  });

  describe("generateTitle", () => {
    it("メッセージから先頭50文字のタイトルを生成する", () => {
      expect(generateTitle("こんにちは")).toBe("こんにちは");
    });

    it("50文字を超えると省略記号がつく", () => {
      const long = "あ".repeat(60);
      const title = generateTitle(long);
      expect(title.length).toBe(51);
      expect(title.endsWith("…")).toBe(true);
    });

    it("改行はスペースに変換される", () => {
      expect(generateTitle("行1\n行2")).toBe("行1 行2");
    });

    it("空文字列は '新しい会話' を返す", () => {
      expect(generateTitle("")).toBe("新しい会話");
    });

    it("空白のみは '新しい会話' を返す", () => {
      expect(generateTitle("   ")).toBe("新しい会話");
    });
  });
});
