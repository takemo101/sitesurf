import { create } from "zustand";

import type { AIMessage } from "@/ports/ai-provider";
import type { Session, SessionMeta, ChatMessage, ToolCallInfo } from "@/ports/session-types";
import type { ArtifactStoragePort } from "@/ports/artifact-storage";
import type { AppStore } from "@/store/types";

import { createChatSlice } from "@/features/chat/chat-store";
import { createSettingsSlice, type Settings } from "@/features/settings/settings-store";
import { createSessionSlice } from "@/features/sessions/session-slice";
import { createUISlice } from "@/sidepanel/ui-store";
import { createArtifactSlice } from "@/features/artifacts/artifact-slice";

export type { AppStore, TabInfo } from "@/store/types";
export type { Session, SessionMeta, ChatMessage, ToolCallInfo, AIMessage };
export type { Settings, AuthCredentials } from "@/features/settings/settings-store";
export type { ChatSlice } from "@/features/chat/chat-store";
export type { SettingsSlice } from "@/features/settings/settings-store";
export type { SessionSlice } from "@/features/sessions/session-slice";
export type { UISlice } from "@/sidepanel/ui-store";
export type { ArtifactSlice } from "@/features/artifacts/artifact-slice";

let _artifactStorage: (ArtifactStoragePort & { setSessionId(id: string | null): void }) | undefined;

export function initStore(
  artifactStorage: ArtifactStoragePort & { setSessionId(id: string | null): void },
): void {
  _artifactStorage = artifactStorage;
}

function getStorage(): ArtifactStoragePort {
  if (!_artifactStorage) {
    throw new Error("initStore() が呼ばれていません。artifactStorage が未初期化です。");
  }
  return _artifactStorage;
}

export const useStore = create<AppStore>()((...a) => ({
  ...createChatSlice(...a),
  ...createSettingsSlice(...a),
  ...createSessionSlice(...a),
  ...createUISlice(...a),
  ...createArtifactSlice(getStorage)(...a),
}));
