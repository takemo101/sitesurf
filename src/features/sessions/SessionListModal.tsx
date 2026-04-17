import { useEffect, useMemo, useState } from "react";
import { Group, Modal, ScrollArea, Stack, Text, TextInput } from "@mantine/core";
import { modals } from "@mantine/modals";
import { notifications } from "@mantine/notifications";
import { Search } from "lucide-react";
import { useStore } from "@/store/index";
import { useDeps } from "@/shared/deps-context";
import * as port from "@/shared/port";
import type { SessionMeta } from "@/ports/session-types";
import { deleteSession, loadSessionList, switchSession } from "./session-store";
import type { SessionLocks, SessionStoreDeps } from "./types";
import { isOlderThan } from "./format-relative-date";
import { SessionItem } from "./SessionItem";
import { DeleteOldMenu } from "./DeleteOldMenu";
import { EmptyState } from "./EmptyState";

interface SessionListModalProps {
  opened: boolean;
  onClose: () => void;
}

function useSessionStoreDeps(): SessionStoreDeps {
  const deps = useDeps();
  const windowId = useStore((s) => s.windowId);
  return {
    sessionStorage: deps.sessionStorage,
    toolResultStore: deps.toolResultStore,
    acquireLock: async (sessionId: string) => {
      try {
        const r = await port.sendMessage({ type: "acquireLock", sessionId, windowId }, 2000);
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
}

function getStoreActions() {
  const state = useStore.getState();
  return {
    setSessionList: state.setSessionList,
    setArtifactSessionId: state.setArtifactSessionId,
    loadSession: state.loadSession,
    setSessionLoading: state.setSessionLoading,
    clearAll: state.clearAll,
  };
}

export function SessionListModal({ opened, onClose }: SessionListModalProps) {
  const [query, setQuery] = useState("");
  const [locks, setLocks] = useState<SessionLocks>({});
  const sessionList = useStore((s) => s.sessionList);
  const activeSessionId = useStore((s) => s.activeSessionId);
  const windowId = useStore((s) => s.windowId);
  const storeDeps = useSessionStoreDeps();

  useEffect(() => {
    if (!opened) return;
    storeDeps.getSessionLocks().then(setLocks);
  }, [opened]);

  const filtered = useMemo(() => {
    if (!query.trim()) return sessionList;
    const q = query.toLowerCase();
    return sessionList.filter(
      (s) => s.title.toLowerCase().includes(q) || s.preview.toLowerCase().includes(q),
    );
  }, [sessionList, query]);

  const totalMessages = useMemo(
    () => sessionList.reduce((sum, s) => sum + s.messageCount, 0),
    [sessionList],
  );

  const handleSelect = async (sessionId: string) => {
    onClose();
    try {
      await switchSession(storeDeps, getStoreActions(), sessionId);
    } catch (err) {
      notifications.show({
        title: "エラー",
        message: err instanceof Error ? err.message : "セッションの切替に失敗しました",
        color: "red",
      });
    }
  };

  const handleDelete = (meta: SessionMeta) => {
    modals.openConfirmModal({
      title: "セッションの削除",
      children: <Text size="sm">「{meta.title}」を削除しますか？この操作は取り消せません。</Text>,
      labels: { confirm: "削除", cancel: "キャンセル" },
      confirmProps: { color: "red" },
      onConfirm: async () => {
        try {
          await deleteSession(storeDeps, getStoreActions(), meta.id, activeSessionId);
          notifications.show({
            title: "セッションを削除しました",
            message: "",
            color: "blue",
            autoClose: 3000,
          });
        } catch (err) {
          notifications.show({
            title: "エラー",
            message: err instanceof Error ? err.message : "削除に失敗しました",
            color: "red",
          });
        }
      },
    });
  };

  const handleDeleteOlderThan = async (days: number) => {
    const toDelete = sessionList.filter(
      (s) => s.id !== activeSessionId && !isLocked(s) && isOlderThan(s.lastModified, days),
    );

    let deleted = 0;
    for (const s of toDelete) {
      try {
        await storeDeps.sessionStorage.deleteSession(s.id);
        deleted++;
      } catch {
        /* intentionally skip — partial success is acceptable */
      }
    }

    await loadSessionList(storeDeps, getStoreActions());
    notifications.show({
      title: `${deleted}件のセッションを削除しました`,
      message: "",
      color: "blue",
      autoClose: 3000,
    });
  };

  const handleDeleteAll = async () => {
    const toDelete = sessionList.filter((s) => s.id !== activeSessionId && !isLocked(s));

    let deleted = 0;
    for (const s of toDelete) {
      try {
        await storeDeps.sessionStorage.deleteSession(s.id);
        deleted++;
      } catch {
        /* intentionally skip — partial success is acceptable */
      }
    }

    await loadSessionList(storeDeps, getStoreActions());
    notifications.show({
      title: `${deleted}件のセッションを削除しました`,
      message: "",
      color: "blue",
      autoClose: 3000,
    });
  };

  const isLocked = (meta: SessionMeta) => {
    const owner = locks[meta.id];
    return owner !== undefined && owner !== windowId;
  };

  return (
    <Modal opened={opened} onClose={onClose} title="セッション一覧" size="md">
      <Stack gap="sm">
        <DeleteOldMenu
          sessions={sessionList}
          activeSessionId={activeSessionId}
          onDeleteOlderThan={handleDeleteOlderThan}
          onDeleteAll={handleDeleteAll}
        />

        <TextInput
          placeholder="セッション検索..."
          leftSection={<Search size={14} />}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />

        <Group gap="xs">
          <Text size="xs" c="dimmed">
            {sessionList.length} セッション
          </Text>
          <Text size="xs" c="dimmed">
            · {totalMessages} メッセージ
          </Text>
        </Group>

        <ScrollArea.Autosize mah={400}>
          {filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <Stack gap="xs">
              {filtered.map((meta) => (
                <SessionItem
                  key={meta.id}
                  meta={meta}
                  isLocked={isLocked(meta)}
                  isCurrent={meta.id === activeSessionId}
                  onSelect={() => handleSelect(meta.id)}
                  onDelete={() => handleDelete(meta)}
                />
              ))}
            </Stack>
          )}
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
}
