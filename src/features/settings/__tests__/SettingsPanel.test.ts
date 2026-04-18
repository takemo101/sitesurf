// @vitest-environment jsdom

import { act } from "react";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InMemoryStorage } from "@/adapters/storage/in-memory-storage";
import { DepsProvider, type AppDeps } from "@/shared/deps-context";
import { initStore, useStore } from "@/store";
import { loadSettings } from "../persistence";
import { SettingsPanel } from "../SettingsPanel";

const mockArtifactStorage = {
  createOrUpdate: async () => {},
  get: async () => null,
  list: async () => [],
  delete: async () => {},
  saveFile: async () => {},
  getFile: async () => null,
  listFiles: async () => [],
  deleteFile: async () => {},
  clearAll: async () => {},
  setSessionId: () => {},
};

function createDeps(storage: InMemoryStorage): AppDeps {
  return {
    createAIProvider: vi.fn(),
    authProviders: {},
    browserExecutor: {} as AppDeps["browserExecutor"],
    storage,
    sessionStorage: {} as AppDeps["sessionStorage"],
    artifactStorage: mockArtifactStorage,
    toolResultStore: {} as AppDeps["toolResultStore"],
  };
}

describe("SettingsPanel", () => {
  let container: HTMLDivElement;
  let root: Root;
  let storage: InMemoryStorage;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.spyOn(notifications, "show").mockImplementation(() => "notification-id");
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );

    storage = new InMemoryStorage();
    initStore(mockArtifactStorage);
    useStore.setState(useStore.getInitialState());
    useStore.getState().setSettingsOpen(true);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  async function renderPanel() {
    await act(async () => {
      root.render(
        createElement(
          MantineProvider,
          null,
          createElement(DepsProvider, { value: createDeps(storage) }, createElement(SettingsPanel)),
        ),
      );
    });
  }

  it("autoCompact トグルを 1 つだけ表示する", async () => {
    await renderPanel();

    expect(document.body.textContent?.match(/クラウドで自動圧縮を有効にする/g) ?? []).toHaveLength(
      1,
    );
  });

  it("autoCompact を保存すると永続化される", async () => {
    await renderPanel();

    const checkbox = document.body.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox).not.toBeNull();

    await act(async () => {
      checkbox?.click();
    });

    const saveButton = Array.from(document.body.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "保存",
    );
    expect(saveButton).toBeDefined();

    await act(async () => {
      saveButton?.click();
    });

    const saved = await loadSettings(storage);
    expect(saved?.autoCompact).toBe(false);
  });
});
