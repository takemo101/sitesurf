import type { StateCreator } from "zustand";
import type { ColorScheme } from "@/shared/constants";
import type { AppStore, TabInfo } from "@/store/types";

export interface UISlice {
  settingsOpen: boolean;
  artifactPanelOpen: boolean;
  isToolNavigating: boolean;
  currentTab: TabInfo;
  tab: TabInfo;
  pendingScreenshot: string | null;
  theme: ColorScheme;
  windowId: number;

  setSettingsOpen(v: boolean): void;
  toggleSettings(): void;
  setArtifactPanelOpen(v: boolean): void;
  toggleArtifactPanel(): void;
  setToolNavigating(v: boolean): void;
  setTab(tab: TabInfo): void;
  setPendingScreenshot(s: string | null): void;
  setTheme(t: ColorScheme): void;
  setWindowId(id: number): void;
}

const DEFAULT_TAB: TabInfo = { id: null, url: "", title: "" };

export const createUISlice: StateCreator<AppStore, [], [], UISlice> = (set, get) => ({
  settingsOpen: false,
  artifactPanelOpen: false,
  isToolNavigating: false,
  currentTab: DEFAULT_TAB,
  tab: DEFAULT_TAB,
  pendingScreenshot: null,
  theme: "auto",
  windowId: 0,

  setSettingsOpen: (v) => set({ settingsOpen: v }),
  toggleSettings: () => set({ settingsOpen: !get().settingsOpen }),
  setArtifactPanelOpen: (v) => set({ artifactPanelOpen: v }),
  toggleArtifactPanel: () => set({ artifactPanelOpen: !get().artifactPanelOpen }),
  setToolNavigating: (v) => set({ isToolNavigating: v }),
  setTab: (tab) => set({ currentTab: tab, tab }),
  setPendingScreenshot: (s) => set({ pendingScreenshot: s }),
  setTheme: (t) => set({ theme: t }),
  setWindowId: (id) => set({ windowId: id }),
});
