import type { ChatSlice } from "@/features/chat/chat-store";
import type { SettingsSlice } from "@/features/settings/settings-store";
import type { SessionSlice } from "@/features/sessions/session-slice";
import type { UISlice } from "@/sidepanel/ui-store";
import type { ArtifactSlice } from "@/features/artifacts/artifact-slice";

export interface TabInfo {
  id?: number | null;
  tabId?: number | null;
  url: string;
  title: string;
}

export type AppStore = ChatSlice & SettingsSlice & SessionSlice & UISlice & ArtifactSlice;
