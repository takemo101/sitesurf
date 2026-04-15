import { useRef, useState } from "react";
import { Text, TextInput, UnstyledButton } from "@mantine/core";
import { useStore } from "@/store/index";
import { useDeps } from "@/shared/deps-context";
import * as port from "@/shared/port";
import { renameSession } from "./session-store";
import type { SessionStoreDeps } from "./types";

export function SessionTitle() {
  const [editing, setEditing] = useState(false);
  const title = useStore((s) => s.activeSessionSnapshot?.title ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setEditing(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  const deps = useDeps();

  const commit = async (value: string) => {
    const trimmed = value.trim();
    const {
      activeSessionId,
      activeSessionSnapshot,
      setSessionList,
      setArtifactSessionId,
      loadSession,
      setSessionLoading,
      clearAll,
    } = useStore.getState();

    if (trimmed && trimmed !== title && activeSessionId) {
      const currentWindowId = useStore.getState().windowId;
      const storeDeps: SessionStoreDeps = {
        sessionStorage: deps.sessionStorage,
        acquireLock: async (sessionId: string) => {
          try {
            const r = await port.sendMessage(
              { type: "acquireLock", sessionId, windowId: currentWindowId },
              2000,
            );
            return { success: r.success };
          } catch {
            return { success: false };
          }
        },
        releaseLock: async () => {},
        getSessionLocks: async () => {
          try {
            const r = await port.sendMessage({ type: "getLockedSessions" }, 2000);
            return r.locks;
          } catch {
            return {};
          }
        },
      };

      await renameSession(
        storeDeps,
        {
          setSessionList,
          setArtifactSessionId,
          loadSession,
          setSessionLoading,
          clearAll,
        },
        activeSessionId,
        trimmed,
        activeSessionSnapshot,
      );
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <TextInput
        ref={inputRef}
        defaultValue={title}
        size="xs"
        w={160}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit(e.currentTarget.value);
          if (e.key === "Escape") setEditing(false);
        }}
        onBlur={(e) => commit(e.currentTarget.value)}
      />
    );
  }

  return (
    <UnstyledButton
      onClick={startEdit}
      px={6}
      py={2}
      style={{ borderRadius: 4, maxWidth: 160 }}
      className="hover-highlight"
    >
      <Text size="xs" truncate>
        {title || "新しい会話"}
      </Text>
    </UnstyledButton>
  );
}
