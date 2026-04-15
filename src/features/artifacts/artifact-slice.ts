import type { StateCreator } from "zustand";
import type { ArtifactStoragePort } from "@/ports/artifact-storage";
import type { AppStore } from "@/store/types";
import { detectType, type ArtifactEntry } from "./types";

export interface ArtifactSlice {
  artifacts: ArtifactEntry[];
  selectedArtifact: string | null;

  loadArtifacts(): Promise<void>;
  setArtifactSessionId(sessionId: string | null): void;
  selectArtifact(name: string | null): void;
  removeArtifact(name: string): Promise<void>;
  clearArtifacts(): void;
  setArtifacts(artifacts: ArtifactEntry[]): void;
  addArtifact(
    name: string,
    type: ArtifactEntry["type"],
    source: ArtifactEntry["source"],
  ): Promise<void>;
}

export function createArtifactSlice(
  getStorage: () => ArtifactStoragePort,
): StateCreator<AppStore, [], [], ArtifactSlice> {
  return (set, get) => ({
    artifacts: [],
    selectedArtifact: null,

    loadArtifacts: async () => {
      const storage = getStorage();
      const [jsonNames, fileNames] = await Promise.all([storage.list(), storage.listFiles()]);
      const seen = new Set<string>();
      const entries: ArtifactEntry[] = [];
      for (const name of jsonNames) {
        if (!seen.has(name)) {
          seen.add(name);
          const detectedType = detectType(name);
          // JSON-sourced artifacts without a file extension get type "json"
          const type = detectedType === "binary" ? "json" : detectedType;
          entries.push({ name, type, source: "json", updatedAt: Date.now() });
        }
      }
      for (const name of fileNames) {
        if (!seen.has(name)) {
          seen.add(name);
          entries.push({ name, type: detectType(name), source: "file", updatedAt: Date.now() });
        }
      }
      set({ artifacts: entries });
    },

    setArtifactSessionId: (sessionId) => {
      const storage = getStorage();
      storage.setSessionId(sessionId);
    },

    selectArtifact: (name) => set({ selectedArtifact: name }),

    removeArtifact: async (name) => {
      const storage = getStorage();
      const entry = get().artifacts.find((a) => a.name === name);
      if (!entry) return;
      if (entry.source === "file") {
        await storage.deleteFile(name);
      } else {
        await storage.delete(name);
      }
      set((s) => ({
        artifacts: s.artifacts.filter((a) => a.name !== name),
        selectedArtifact: s.selectedArtifact === name ? null : s.selectedArtifact,
      }));
    },

    clearArtifacts: () => {
      // Just clear UI state, don't delete from storage
      // (Storage is session-specific via sessionId in keys)
      set({ artifacts: [], selectedArtifact: null });
    },

    setArtifacts: (artifacts) => set({ artifacts }),

    addArtifact: async (name, type, source) => {
      const entry: ArtifactEntry = {
        name,
        type,
        source,
        updatedAt: Date.now(),
      };
      set((s) => {
        const existing = s.artifacts.findIndex((a) => a.name === name);
        const artifacts =
          existing >= 0
            ? s.artifacts.map((a, i) => (i === existing ? entry : a))
            : [...s.artifacts, entry];
        return { artifacts, selectedArtifact: name };
      });
    },
  });
}
