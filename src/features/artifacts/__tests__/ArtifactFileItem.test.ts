// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArtifactStoragePort } from "@/ports/artifact-storage";
import { initStore, useStore } from "@/store";
import { ArtifactFileItem } from "../ArtifactFileItem";

function makeStorage(): ArtifactStoragePort {
  return {
    put: vi.fn(),
    get: vi.fn(),
    list: vi.fn().mockResolvedValue([]),
    delete: vi.fn(),
    clearAll: vi.fn(),
    setSessionId: vi.fn(),
    createOrUpdate: vi.fn(),
    saveFile: vi.fn(),
    getFile: vi.fn(),
    listFiles: vi.fn().mockResolvedValue([]),
    deleteFile: vi.fn(),
  };
}

describe("ArtifactFileItem", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
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
    initStore(makeStorage());
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

  async function render(artifact: Parameters<typeof ArtifactFileItem>[0]["artifact"]) {
    await act(async () => {
      root.render(
        createElement(
          MantineProvider,
          null,
          createElement(ArtifactFileItem, { artifact, selected: false }),
        ),
      );
    });
  }

  it("shows 'json' kind badge for source === 'json'", async () => {
    await render({
      name: "data.json",
      type: "json",
      source: "json",
      updatedAt: Date.now(),
    });
    const badge = container.querySelector('[data-testid="artifact-kind-badge"]');
    expect(badge?.textContent).toBe("json");
  });

  it("shows 'file' kind badge for source === 'file'", async () => {
    await render({
      name: "page.html",
      type: "html",
      source: "file",
      updatedAt: Date.now(),
    });
    const badge = container.querySelector('[data-testid="artifact-kind-badge"]');
    expect(badge?.textContent).toBe("file");
  });

  it("renders the filename", async () => {
    await render({
      name: "my-artifact.md",
      type: "markdown",
      source: "file",
      updatedAt: Date.now(),
    });
    expect(container.textContent).toContain("my-artifact.md");
  });
});
