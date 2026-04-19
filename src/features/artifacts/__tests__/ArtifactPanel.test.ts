// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArtifactStoragePort } from "@/ports/artifact-storage";
import { DepsProvider, type AppDeps } from "@/shared/deps-context";
import { initStore, useStore } from "@/store";
import { ArtifactPanel } from "../ArtifactPanel";

vi.mock("../ArtifactPreview", () => ({
  ArtifactPreview: ({ data }: { data: { content: string | object } }) =>
    createElement("div", { "data-testid": "artifact-preview" }, String(data.content)),
}));

describe("ArtifactPanel", () => {
  let container: HTMLDivElement;
  let root: Root;
  let currentSessionId: string | null;
  let artifactStorage: ArtifactStoragePort & { setSessionId(id: string | null): void };

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
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
    Element.prototype.scrollIntoView = vi.fn();

    currentSessionId = "session-1";
    artifactStorage = {
      put: vi.fn(),
      get: vi.fn(
        async () =>
          ({
            kind: "file",
            bytes: new TextEncoder().encode(currentSessionId === "session-1" ? "first" : "second"),
            mimeType: "text/plain",
          }) as const,
      ),
      list: vi.fn(),
      delete: vi.fn(),
      clearAll: vi.fn(),
      setSessionId: vi.fn((sessionId: string | null) => {
        currentSessionId = sessionId;
      }),
    };

    initStore(artifactStorage);
    useStore.setState(useStore.getInitialState());

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
    const deps: AppDeps = {
      createAIProvider: vi.fn(),
      authProviders: {},
      browserExecutor: {} as AppDeps["browserExecutor"],
      storage: {} as AppDeps["storage"],
      sessionStorage: {} as AppDeps["sessionStorage"],
      artifactStorage,
    };

    await act(async () => {
      root.render(
        createElement(
          MantineProvider,
          null,
          createElement(DepsProvider, { value: deps }, createElement(ArtifactPanel)),
        ),
      );
    });
  }

  it("activeSessionId が変わると同名 artifact を再読込する", async () => {
    useStore.setState({
      activeSessionId: "session-1",
      selectedArtifact: "shared.txt",
      artifacts: [
        {
          name: "shared.txt",
          type: "text",
          source: "file",
          updatedAt: 10,
        },
      ],
    });

    await renderPanel();

    expect(container.textContent).toContain("first");
    expect(artifactStorage.get).toHaveBeenCalledTimes(1);

    currentSessionId = "session-2";
    await act(async () => {
      useStore.setState({
        activeSessionId: "session-2",
        selectedArtifact: "shared.txt",
        artifacts: [
          {
            name: "shared.txt",
            type: "text",
            source: "file",
            updatedAt: 10,
          },
        ],
      });
    });

    expect(container.textContent).toContain("second");
    expect(artifactStorage.get).toHaveBeenCalledTimes(2);
  });
});
