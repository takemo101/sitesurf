import { Button, Menu, Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { Trash2 } from "lucide-react";
import type { SessionMeta } from "@/ports/session-types";
import { isOlderThan } from "./format-relative-date";

interface DeleteOldMenuProps {
  sessions: SessionMeta[];
  activeSessionId: string | null;
  onDeleteOlderThan: (days: number) => void;
  onDeleteAll: () => void;
}

function countDeletable(
  sessions: SessionMeta[],
  activeSessionId: string | null,
  days: number,
): number {
  return sessions.filter((s) => s.id !== activeSessionId && isOlderThan(s.lastModified, days))
    .length;
}

export function DeleteOldMenu({
  sessions,
  activeSessionId,
  onDeleteOlderThan,
  onDeleteAll,
}: DeleteOldMenuProps) {
  const handleDeleteOlderThan = (days: number) => {
    const count = countDeletable(sessions, activeSessionId, days);
    if (count === 0) return;

    modals.openConfirmModal({
      title: "古いセッションの削除",
      children: (
        <Text size="sm">
          {days}日以上前の{count}件のセッションを削除しますか？
        </Text>
      ),
      labels: { confirm: `${count}件削除`, cancel: "キャンセル" },
      confirmProps: { color: "red" },
      onConfirm: () => onDeleteOlderThan(days),
    });
  };

  const handleDeleteAll = () => {
    const count = sessions.filter((s) => s.id !== activeSessionId).length;
    if (count === 0) return;

    modals.openConfirmModal({
      title: "すべてのセッションを削除",
      children: (
        <Text size="sm">
          現在のセッションを除く{count}
          件のセッションをすべて削除しますか？この操作は取り消せません。
        </Text>
      ),
      labels: { confirm: `${count}件削除`, cancel: "キャンセル" },
      confirmProps: { color: "red" },
      onConfirm: onDeleteAll,
    });
  };

  return (
    <Menu>
      <Menu.Target>
        <Button variant="subtle" size="xs" leftSection={<Trash2 size={12} />}>
          古いセッションを削除
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item color="red" onClick={() => handleDeleteOlderThan(7)}>
          7日以上前
        </Menu.Item>
        <Menu.Item color="red" onClick={() => handleDeleteOlderThan(30)}>
          30日以上前
        </Menu.Item>
        <Menu.Item color="red" onClick={() => handleDeleteOlderThan(90)}>
          90日以上前
        </Menu.Item>
        <Menu.Divider />
        <Menu.Item color="red" onClick={handleDeleteAll}>
          すべて削除
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
