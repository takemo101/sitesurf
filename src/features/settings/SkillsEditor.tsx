import type React from "react";
import { useState, useCallback, useEffect } from "react";
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Collapse,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  Textarea,
  Tooltip,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Code,
  FileText,
  Globe,
  Pencil,
  Plus,
  Puzzle,
  Trash2,
} from "lucide-react";

import type { Skill } from "@/shared/skill-types";
import { buildSkillDraftPreview } from "@/shared/skill-draft-preview";
import { parseSkillMarkdown } from "@/shared/skill-parser";
import {
  normalizeLegacyExtractorCode,
  validateSkillDefinition,
  validateSkillDraftDefinition,
} from "@/shared/skill-validation";
import { useDeps } from "@/shared/deps-context";

import type { StoredSkill } from "./skills-persistence";
import { notifySkillRegistryReload } from "./skill-registry-sync";
import {
  canUpsertStoredSkill,
  getSkillListItemKey,
  tryUpsertStoredSkill,
} from "./skills-editor-state";
import { approveSkillDraft, discardSkillDraft } from "./skills-drafts-state";
import { loadCustomSkills, saveCustomSkills } from "./skills-persistence";
import { loadSkillDrafts, saveSkillDrafts } from "./skills-drafts-persistence";
import type { StoredSkillDraft } from "@/shared/skill-draft-types";

export const BUILTIN_SKILLS_MANIFEST_PATH = "/skills/skills-manifest.json";

export function getBuiltinSkillFilePath(file: string): string {
  return `/skills/${file}`;
}

const SKILL_TEMPLATE = `---
id: my-custom-skill
name: My Custom Skill
description: A description of what this skill does
hosts:
  - example.com
---

# Instructions

AI 向けのサイトスコープのガイダンスをここに書く。省略可。
instructions-only の skill にしたい場合は下の # Extractors セクションを書かない。

# Extractors

## pageTitle
Extract the page title
\`\`\`js
function () {
  return document.title;
}
\`\`\`

## pageUrl
Extract the current URL
\`\`\`js
function () {
  return window.location.href;
}
\`\`\`
`;

interface SkillListItem {
  skill: Skill;
  markdown: string;
  isBuiltIn: boolean;
}

export function parseAndValidateSkillMarkdown(
  markdown: string,
): { ok: true; skill: Skill; warnings: string[] } | { ok: false; errors: string[] } {
  const parsed = parseSkillMarkdown(markdown);
  if (!parsed.ok) {
    return parsed;
  }

  const validation = validateSkillDraftDefinition(parsed.skill);
  if (validation.status === "reject") {
    return {
      ok: false,
      errors: validation.errors.map((error) => error.message),
    };
  }

  return {
    ok: true,
    skill: parsed.skill,
    warnings: validation.warnings.map((w) => w.message),
  };
}

function normalizeBuiltinSkill(skill: Skill): Skill {
  return {
    ...skill,
    extractors: skill.extractors.map((extractor) => ({
      ...extractor,
      code: normalizeLegacyExtractorCode(extractor.code),
    })),
  };
}

async function fetchBuiltinSkills(): Promise<Skill[]> {
  try {
    const response = await fetch(BUILTIN_SKILLS_MANIFEST_PATH);
    if (!response.ok) return [];
    const manifest = await response.json();
    const skills: Skill[] = [];

    for (const entry of manifest.builtinSkills || []) {
      try {
        const skillResponse = await fetch(getBuiltinSkillFilePath(entry.file));
        if (!skillResponse.ok) continue;
        const markdown = await skillResponse.text();
        const parsed = parseSkillMarkdown(markdown);
        if (parsed.ok) {
          const normalized = normalizeBuiltinSkill(parsed.skill);
          // skill-loader.ts と同じ validateSkillDefinition で構造チェック
          // （ドラフト用の厳しいバリデーションではなく通常バリデーション）
          const validation = validateSkillDefinition(normalized);
          if (validation.valid) {
            skills.push(normalized);
          }
        }
      } catch {
        // individual fetch errors are non-fatal
      }
    }
    return skills;
  } catch {
    return [];
  }
}

// --- Skill Card ---

function SkillCard({
  item,
  onEdit,
  onDelete,
}: {
  item: SkillListItem;
  onEdit?: (item: SkillListItem) => void;
  onDelete?: (skillId: string) => void | Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const { skill, isBuiltIn } = item;
  const hasExtractors = skill.extractors.length > 0;

  return (
    <Paper withBorder p="xs" radius="sm">
      <Group
        gap="xs"
        justify="space-between"
        align="flex-start"
        wrap="nowrap"
        style={{ cursor: hasExtractors ? "pointer" : undefined }}
        onClick={() => hasExtractors && setExpanded((v: boolean) => !v)}
      >
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          <Group gap="xs" align="center" wrap="nowrap">
            {hasExtractors && (expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
            <Text fw={600} size="sm" truncate>
              {skill.name}
            </Text>
            <Badge
              size="xs"
              variant={isBuiltIn ? "light" : "filled"}
              color={isBuiltIn ? "gray" : "indigo"}
            >
              {isBuiltIn ? "ビルトイン" : "カスタム"}
            </Badge>
          </Group>

          {skill.description && skill.description !== skill.name && (
            <Text size="xs" c="dimmed" lineClamp={2} pl={hasExtractors ? 20 : 0}>
              {skill.description}
            </Text>
          )}

          <Group gap={6} pl={hasExtractors ? 20 : 0}>
            {skill.matchers.hosts.map((host, index) => (
              <Badge
                key={`${getSkillListItemKey(skill.id, isBuiltIn)}:host:${host}:${index}`}
                size="xs"
                variant="outline"
                leftSection={<Globe size={10} />}
              >
                {host}
              </Badge>
            ))}
            {skill.extractors.length > 0 && (
              <Badge size="xs" variant="light" color="gray" leftSection={<Code size={10} />}>
                {skill.extractors.length} extractors
              </Badge>
            )}
          </Group>
        </Stack>

        {!isBuiltIn && (
          <Group gap={4} wrap="nowrap">
            {onEdit && (
              <Tooltip label="編集">
                <ActionIcon
                  size="sm"
                  variant="subtle"
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    onEdit(item);
                  }}
                  aria-label={`Edit ${skill.name}`}
                >
                  <Pencil size={14} />
                </ActionIcon>
              </Tooltip>
            )}
            {onDelete && (
              <Tooltip label="削除">
                <ActionIcon
                  size="sm"
                  color="red"
                  variant="subtle"
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    onDelete(skill.id);
                  }}
                  aria-label={`Delete ${skill.name}`}
                >
                  <Trash2 size={14} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        )}
      </Group>

      {hasExtractors && (
        <Collapse expanded={expanded}>
          <Stack gap={4} mt="xs" pl={20}>
            {skill.extractors.map((ext, index) => (
              <Group
                key={`${getSkillListItemKey(skill.id, isBuiltIn)}:extractor:${ext.id}:${index}`}
                gap="xs"
                align="flex-start"
                wrap="nowrap"
              >
                <FileText size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                <Stack gap={0} style={{ minWidth: 0 }}>
                  <Text size="xs" fw={500} truncate>
                    {ext.name}
                  </Text>
                  {ext.description && ext.description !== ext.name && (
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {ext.description}
                    </Text>
                  )}
                </Stack>
              </Group>
            ))}
          </Stack>
        </Collapse>
      )}
    </Paper>
  );
}

function validationColor(status: StoredSkillDraft["validation"]["status"]): string {
  switch (status) {
    case "ok":
      return "green";
    case "warning":
      return "yellow";
    case "reject":
      return "red";
  }
}

function validationLabel(status: StoredSkillDraft["validation"]["status"]): string {
  switch (status) {
    case "ok":
      return "OK";
    case "warning":
      return "警告あり";
    case "reject":
      return "要修正";
  }
}

function SkillDraftCard({
  draft,
  onApprove,
  onDiscard,
}: {
  draft: StoredSkillDraft;
  onApprove: (draftId: string) => void | Promise<void>;
  onDiscard: (draftId: string) => void | Promise<void>;
}) {
  return (
    <Paper withBorder p="xs" radius="sm">
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
            <Group gap="xs" wrap="nowrap">
              <Text fw={600} size="sm" truncate>
                {draft.normalizedSkill.name}
              </Text>
              <Badge size="xs" color={validationColor(draft.validation.status)}>
                {validationLabel(draft.validation.status)}
              </Badge>
              <Badge size="xs" variant="light" color="gray">
                下書き
              </Badge>
            </Group>
            <Text size="xs" c="dimmed">
              {draft.normalizedSkill.description}
            </Text>
          </Stack>

          <Group gap={4} wrap="nowrap">
            <Button
              size="compact-xs"
              variant="light"
              onClick={() => onApprove(draft.draftId)}
              disabled={draft.validation.status === "reject"}
            >
              承認保存
            </Button>
            <Button
              size="compact-xs"
              color="red"
              variant="subtle"
              onClick={() => onDiscard(draft.draftId)}
            >
              破棄
            </Button>
          </Group>
        </Group>

        {(draft.validation.errors.length > 0 || draft.validation.warnings.length > 0) && (
          <Alert
            icon={<AlertCircle size={16} />}
            color={draft.validation.status === "reject" ? "red" : "yellow"}
          >
            <Stack gap={4}>
              {draft.validation.errors.map((issue, index) => (
                <Text key={`error:${draft.draftId}:${index}`} size="xs">
                  Error: {issue.message}
                </Text>
              ))}
              {draft.validation.warnings.map((issue, index) => (
                <Text key={`warning:${draft.draftId}:${index}`} size="xs">
                  Warning: {issue.message}
                </Text>
              ))}
            </Stack>
          </Alert>
        )}

        {draft.suggestedFixes.length > 0 && (
          <Alert icon={<Check size={16} />} color="blue">
            <Stack gap={4}>
              {draft.suggestedFixes.map((fix, index) => (
                <Text key={`fix:${draft.draftId}:${index}`} size="xs">
                  • {fix}
                </Text>
              ))}
            </Stack>
          </Alert>
        )}

        <Textarea
          label="承認前プレビュー"
          value={buildSkillDraftPreview(draft)}
          readOnly
          autosize
          minRows={8}
          maxRows={18}
          styles={{
            input: {
              fontFamily: "monospace",
              fontSize: "0.78rem",
            },
          }}
        />
      </Stack>
    </Paper>
  );
}

// --- Edit Modal ---

function SkillEditModal({
  opened,
  onClose,
  initialMarkdown,
  onSaved,
}: {
  opened: boolean;
  onClose: () => void;
  initialMarkdown: string;
  onSaved: (skill: Skill, markdown: string) => Promise<boolean>;
}) {
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (opened) {
      setMarkdown(initialMarkdown);
      setErrors([]);
    }
  }, [opened, initialMarkdown]);

  const handleInsertTemplate = () => {
    const separator = markdown.trim() && !markdown.endsWith("\n\n") ? "\n\n" : "";
    setMarkdown((prev: string) => prev + separator + SKILL_TEMPLATE);
    setErrors([]);
  };

  const handleValidate = () => {
    if (!markdown.trim()) {
      setErrors(["Markdownが空です"]);
      return;
    }
    const result = parseAndValidateSkillMarkdown(markdown);
    if (!result.ok) {
      setErrors(result.errors);
    } else {
      setErrors([]);
      if (result.warnings.length > 0) {
        notifications.show({
          title: "検証成功（警告あり）",
          message: result.warnings.join("\n"),
          color: "yellow",
          autoClose: 5000,
        });
      } else {
        notifications.show({
          title: "検証成功",
          message: `Skill "${result.skill.name}" の構文は正しいです`,
          color: "green",
          autoClose: 3000,
        });
      }
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const result = parseAndValidateSkillMarkdown(markdown);
      if (!result.ok) {
        setErrors(result.errors);
        notifications.show({
          title: "検証エラー",
          message: "Skillの構文が正しくありません",
          color: "red",
          autoClose: 5000,
        });
        return;
      }
      if (result.warnings.length > 0) {
        notifications.show({
          title: "警告あり",
          message: result.warnings.join("\n"),
          color: "yellow",
          autoClose: 5000,
        });
      }
      const saved = await onSaved(result.skill, markdown);
      if (saved) {
        onClose();
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <Puzzle size={16} />
          <Text fw={600} size="sm">
            {initialMarkdown ? "Skillを編集" : "カスタムSkillを追加"}
          </Text>
        </Group>
      }
      size="lg"
      fullScreen
    >
      <Stack gap="sm">
        <Textarea
          placeholder={SKILL_TEMPLATE}
          value={markdown}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            setMarkdown(e.currentTarget.value)
          }
          minRows={14}
          maxRows={24}
          autosize
          styles={{
            input: {
              fontFamily: "monospace",
              fontSize: "0.8rem",
            },
          }}
        />

        <Text size="xs" c="dimmed">
          本文はトップレベルの <code>{"# Instructions"}</code> と <code>{"# Extractors"}</code>{" "}
          で構成できます。instructions-only / extractors-only /
          両方入りのいずれも保存可能です。どちらも省略した場合は旧形式 (本文すべて extractors
          として解釈) とみなされます。
        </Text>

        {errors.length > 0 && (
          <Alert icon={<AlertCircle size={16} />} color="red">
            <Stack gap={4}>
              {errors.map((error: string, i: number) => (
                <Text key={i} size="xs">
                  {error}
                </Text>
              ))}
            </Stack>
          </Alert>
        )}

        <Group gap="xs" justify="space-between">
          <Button
            size="xs"
            variant="subtle"
            leftSection={<FileText size={14} />}
            onClick={handleInsertTemplate}
          >
            テンプレートを挿入
          </Button>
          <Group gap="xs">
            <Button
              size="xs"
              variant="light"
              leftSection={<Check size={14} />}
              onClick={handleValidate}
              disabled={!markdown.trim()}
            >
              検証
            </Button>
            <Button size="xs" onClick={handleSave} loading={isLoading} disabled={!markdown.trim()}>
              保存
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}

// --- Main Editor ---

export function SkillsEditor() {
  const { storage } = useDeps();
  const [storedSkills, setStoredSkills] = useState<StoredSkill[]>([]);
  const [skillDrafts, setSkillDrafts] = useState<StoredSkillDraft[]>([]);
  const [builtInSkills, setBuiltInSkills] = useState<Skill[]>([]);
  const [builtInSkillsLoaded, setBuiltInSkillsLoaded] = useState(false);
  const [modalOpened, setModalOpened] = useState(false);
  const [editingMarkdown, setEditingMarkdown] = useState("");
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);

  const loadSkills = useCallback(async () => {
    const [loaded, drafts, builtin] = await Promise.all([
      loadCustomSkills(storage),
      loadSkillDrafts(storage),
      fetchBuiltinSkills(),
    ]);
    setStoredSkills(loaded);
    setSkillDrafts(drafts);
    setBuiltInSkills(builtin);
    setBuiltInSkillsLoaded(true);
  }, [storage]);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  const handleOpenNew = () => {
    setEditingMarkdown("");
    setEditingSkillId(null);
    setModalOpened(true);
  };

  const handleOpenEdit = (item: SkillListItem) => {
    setEditingMarkdown(item.markdown);
    setEditingSkillId(item.skill.id);
    setModalOpened(true);
  };

  const handleSaved = async (skill: Skill, _markdown: string) => {
    const latestBuiltInSkills = builtInSkillsLoaded ? builtInSkills : await fetchBuiltinSkills();
    if (!builtInSkillsLoaded) {
      setBuiltInSkills(latestBuiltInSkills);
      setBuiltInSkillsLoaded(true);
    }

    const reservedSkillIds = latestBuiltInSkills.map((builtInSkill: Skill) => builtInSkill.id);
    const conflictError = canUpsertStoredSkill(
      storedSkills,
      skill,
      editingSkillId,
      reservedSkillIds,
    );
    if (conflictError) {
      notifications.show({
        title: "保存できません",
        message: conflictError,
        color: "red",
        autoClose: 5000,
      });
      return false;
    }

    const result = tryUpsertStoredSkill(storedSkills, skill, editingSkillId, reservedSkillIds);
    if (!result.ok || !result.updated) {
      notifications.show({
        title: "保存できません",
        message: result.error ?? "Skillを保存できませんでした",
        color: "red",
        autoClose: 5000,
      });
      return false;
    }

    const updated = result.updated;
    await saveCustomSkills(storage, updated);
    setStoredSkills(updated);
    notifySkillRegistryReload();

    notifications.show({
      title: "保存しました",
      message: `Skill "${skill.name}" を${editingSkillId ? "更新" : "登録"}しました`,
      color: "green",
      autoClose: 3000,
    });

    return true;
  };

  const handleDelete = async (skillId: string) => {
    const updated = storedSkills.filter((s: StoredSkill) => s.skill.id !== skillId);
    await saveCustomSkills(storage, updated);
    setStoredSkills(updated);
    notifySkillRegistryReload();

    notifications.show({
      title: "削除しました",
      message: "Skillを削除しました",
      color: "green",
      autoClose: 3000,
    });
  };

  const handleApproveDraft = async (draftId: string) => {
    const latestBuiltInSkills = builtInSkillsLoaded ? builtInSkills : await fetchBuiltinSkills();
    if (!builtInSkillsLoaded) {
      setBuiltInSkills(latestBuiltInSkills);
      setBuiltInSkillsLoaded(true);
    }

    const reservedSkillIds = latestBuiltInSkills.map((builtInSkill: Skill) => builtInSkill.id);
    const result = approveSkillDraft(storedSkills, skillDrafts, draftId, reservedSkillIds);
    if (!result.ok) {
      notifications.show({
        title: "承認保存できません",
        message: result.error,
        color: "red",
        autoClose: 5000,
      });
      return;
    }

    await Promise.all([
      saveCustomSkills(storage, result.updatedSkills),
      saveSkillDrafts(storage, result.remainingDrafts),
    ]);
    setStoredSkills(result.updatedSkills);
    setSkillDrafts(result.remainingDrafts);
    notifySkillRegistryReload();

    notifications.show({
      title: "Skillを保存しました",
      message: "下書きを承認して custom skill として保存しました",
      color: "green",
      autoClose: 3000,
    });
  };

  const handleDiscardDraft = async (draftId: string) => {
    const remaining = discardSkillDraft(skillDrafts, draftId);
    await saveSkillDrafts(storage, remaining);
    setSkillDrafts(remaining);

    notifications.show({
      title: "下書きを破棄しました",
      message: "保存前の skill draft を削除しました",
      color: "green",
      autoClose: 3000,
    });
  };

  const allSkills: SkillListItem[] = [
    ...builtInSkills.map((s: Skill) => ({ skill: s, markdown: "", isBuiltIn: true })),
    ...storedSkills.map((s: StoredSkill) => ({
      skill: s.skill,
      markdown: s.markdown,
      isBuiltIn: false,
    })),
  ];

  return (
    <>
      <Stack gap="xs">
        <Stack gap={6}>
          <Group gap="xs" justify="space-between" align="center">
            <Text size="xs" fw={600}>
              下書き
            </Text>
            <Badge size="xs" variant="light" color="gray">
              {skillDrafts.length}
            </Badge>
          </Group>

          {skillDrafts.length === 0 ? (
            <Paper withBorder p="md" radius="sm">
              <Text size="xs" c="dimmed">
                チャットから作成した skill draft はまだありません
              </Text>
            </Paper>
          ) : (
            <Stack gap={6}>
              {skillDrafts.map((draft: StoredSkillDraft) => (
                <SkillDraftCard
                  key={draft.draftId}
                  draft={draft}
                  onApprove={handleApproveDraft}
                  onDiscard={handleDiscardDraft}
                />
              ))}
            </Stack>
          )}
        </Stack>

        <Group gap="xs" justify="space-between" align="center">
          <Text size="xs" fw={600}>
            Skills
          </Text>
          <Button
            size="compact-xs"
            variant="light"
            leftSection={<Plus size={12} />}
            onClick={handleOpenNew}
            disabled={!builtInSkillsLoaded}
          >
            追加
          </Button>
        </Group>

        {allSkills.length === 0 ? (
          <Paper withBorder p="md" radius="sm">
            <Stack gap="xs" align="center">
              <Puzzle size={24} color="var(--mantine-color-dimmed)" />
              <Text size="xs" c="dimmed">
                Skillが登録されていません
              </Text>
              <Button
                size="compact-xs"
                variant="light"
                leftSection={<Plus size={12} />}
                onClick={handleOpenNew}
                disabled={!builtInSkillsLoaded}
              >
                カスタムSkillを追加
              </Button>
            </Stack>
          </Paper>
        ) : (
          <Stack gap={6}>
            {allSkills.map((item) => (
              <SkillCard
                key={getSkillListItemKey(item.skill.id, item.isBuiltIn)}
                item={item}
                onEdit={item.isBuiltIn ? undefined : handleOpenEdit}
                onDelete={item.isBuiltIn ? undefined : handleDelete}
              />
            ))}
          </Stack>
        )}
      </Stack>

      <SkillEditModal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        initialMarkdown={editingMarkdown}
        onSaved={handleSaved}
      />
    </>
  );
}
