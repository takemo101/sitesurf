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
}

export function createArtifactSlice(
  getStorage: () => ArtifactStoragePort,
): StateCreator<AppStore, [], [], ArtifactSlice> {
  return (set, get) => ({
    artifacts: [],
    selectedArtifact: null,

    loadArtifacts: async () => {
      const storage = getStorage();
      const artifacts = (await storage.list()).filter((artifact) => artifact.visible);
      const entries: ArtifactEntry[] = artifacts.map((artifact) => {
        const detectedType = detectType(artifact.name);
        const type = artifact.kind === "json" && detectedType === "binary" ? "json" : detectedType;
        return {
          name: artifact.name,
          type,
          source: artifact.kind,
          updatedAt: artifact.updatedAt,
        };
      });
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
      await storage.delete(name);
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
  });
}
