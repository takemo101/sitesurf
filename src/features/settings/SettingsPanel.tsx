import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ActionIcon,
  Box,
  Button,
  Drawer,
  Flex,
  Group,
  PasswordInput,
  Select,
  Slider,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
} from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { Bot, Cog, Puzzle, ShieldCheck, X } from "lucide-react";

import { PROVIDERS } from "@/shared/constants";
import { useDeps } from "@/shared/deps-context";
import { useStore } from "@/store";
import { saveSettings } from "./persistence";
import { MIN_TOKENS, MAX_TOKENS, TOKENS_STEP, TOKEN_MARKS } from "@/shared/token-constants";

import { OAuthSection } from "./OAuthSection";
import { ProviderSelect } from "./ProviderSelect";
import { SkillsEditor } from "./SkillsEditor";
import { getFieldVisibility } from "./provider-visibility";
import type { Settings } from "./settings-store";
import {
  loadSecurityAuditEntries,
  type SecurityAuditLogEntry,
} from "@/orchestration/security-audit";
import { SecurityAuditSettingsSection } from "@/orchestration/SecurityAuditSettingsSection";

const PANEL_SCROLL_STYLE: CSSProperties = {
  height: "100%",
  overflowY: "auto",
  overflowX: "hidden",
};

function SaveButton({ onClick }: { onClick: () => void }) {
  return (
    <Group gap="xs" mt={4}>
      <Button size="xs" onClick={onClick}>
        保存
      </Button>
    </Group>
  );
}

export function SettingsPanel() {
  const settingsOpen = useStore((s) => s.settingsOpen);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);

  const provider = PROVIDERS[settings.provider];
  const visibility = getFieldVisibility(settings.provider);

  const { storage } = useDeps();
  const isNarrow = useMediaQuery("(max-width: 900px)");
  const baselineRef = useRef<string>("");
  const [activeTab, setActiveTab] = useState<string>("ai");
  const [auditEntries, setAuditEntries] = useState<SecurityAuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const serializedSettings = useMemo(() => JSON.stringify(settings), [settings]);
  const hasUnsavedChanges =
    settingsOpen && baselineRef.current !== "" && baselineRef.current !== serializedSettings;

  useEffect(() => {
    if (!settingsOpen) return;
    baselineRef.current = JSON.stringify(settings);
  }, [settingsOpen]);

  useEffect(() => {
    if (!settingsOpen || activeTab !== "security") return;

    let cancelled = false;
    setAuditLoading(true);

    loadSecurityAuditEntries(storage, 20)
      .then((entries) => {
        if (!cancelled) {
          setAuditEntries(entries);
        }
      })
      .catch((error: unknown) => {
        notifications.show({
          title: "監査ログの読み込みに失敗しました",
          message: error instanceof Error ? error.message : String(error),
          color: "red",
          autoClose: 4000,
        });
      })
      .finally(() => {
        if (!cancelled) {
          setAuditLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [settingsOpen, activeTab, storage]);

  const handleSave = async () => {
    try {
      const modelToSave = settings.model || provider.defaultModel;
      const settingsToSave: Settings = { ...settings, model: modelToSave };

      await saveSettings(storage, settingsToSave);
      setSettings({ model: modelToSave });
      baselineRef.current = JSON.stringify(settingsToSave);

      notifications.show({
        title: "設定を保存しました",
        message: "変更内容を保存しました。",
        color: "green",
        autoClose: 3000,
      });
    } catch (error: unknown) {
      notifications.show({
        title: "設定の保存に失敗しました",
        message: error instanceof Error ? error.message : String(error),
        color: "red",
        autoClose: 4000,
      });
    }
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      const shouldClose = window.confirm("未保存の変更があります。保存せずに閉じますか？");
      if (!shouldClose) return;
    }
    setSettingsOpen(false);
  };

  return (
    <Drawer
      opened={settingsOpen}
      onClose={handleClose}
      withCloseButton={false}
      withOverlay
      overlayProps={{ opacity: 0.35, blur: 1 }}
      position="right"
      size={isNarrow ? "100%" : "min(560px, 96vw)"}
      padding={0}
      styles={{ body: { height: "100%", display: "flex", flexDirection: "column" } }}
    >
      <Stack gap="xs" p="sm" style={{ flex: 1, minHeight: 0, height: "100%", overflow: "hidden" }}>
        <Tabs
          value={activeTab}
          onChange={(v) => {
            if (v) setActiveTab(v);
          }}
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <Flex
            justify="space-between"
            align="center"
            gap="xs"
            style={{
              position: "sticky",
              top: 0,
              zIndex: 2,
              background: "var(--mantine-color-body)",
              borderBottom: "1px solid var(--mantine-color-default-border)",
              paddingBottom: 6,
            }}
          >
            <Tabs.List>
              <Tabs.Tab value="ai" leftSection={<Bot size={14} />}>
                AI設定
              </Tabs.Tab>
              <Tabs.Tab value="skills" leftSection={<Puzzle size={14} />}>
                スキル
              </Tabs.Tab>
              <Tabs.Tab value="system" leftSection={<Cog size={14} />}>
                システム
              </Tabs.Tab>
              <Tabs.Tab value="security" aria-label="セキュリティ" title="セキュリティ">
                <ShieldCheck size={14} />
              </Tabs.Tab>
            </Tabs.List>
            <ActionIcon size="sm" variant="subtle" onClick={handleClose} aria-label="閉じる">
              <X size={16} />
            </ActionIcon>
          </Flex>

          <Text size="xs" c="dimmed" mt={2}>
            AI設定/システムは「保存」で反映。スキルはスキルタブ内の保存を使用。セキュリティは閲覧のみ。
          </Text>

          <Tabs.Panel value="ai" pt="xs" style={{ flex: 1, minHeight: 0 }}>
            <Box style={PANEL_SCROLL_STYLE}>
              <Stack gap="xs" pb="sm">
                <ProviderSelect />

                {visibility.showModelSelect ? (
                  <Select
                    label="モデル"
                    data={provider.models}
                    value={settings.model || provider.defaultModel}
                    onChange={(value) => {
                      if (value) setSettings({ model: value });
                    }}
                    allowDeselect={false}
                  />
                ) : (
                  <TextInput
                    label="モデル名"
                    placeholder={provider.defaultModel}
                    value={settings.model || provider.defaultModel}
                    onChange={(e) => setSettings({ model: e.currentTarget.value })}
                  />
                )}

                <Select
                  label="思考レベル"
                  data={[
                    { value: "none", label: "なし" },
                    { value: "low", label: "低" },
                    { value: "medium", label: "中 (推奨)" },
                    { value: "high", label: "高" },
                  ]}
                  value={settings.reasoningLevel}
                  onChange={(value) => {
                    if (value)
                      setSettings({
                        reasoningLevel: value as "none" | "low" | "medium" | "high",
                      });
                  }}
                  allowDeselect={false}
                />

                <div>
                  <Text size="sm" fw={500} mb="xs">
                    最大出力トークン: {settings.maxTokens.toLocaleString()}
                  </Text>
                  <Box pb="xl">
                    <Slider
                      value={settings.maxTokens}
                      onChange={(value) => setSettings({ maxTokens: value })}
                      min={MIN_TOKENS}
                      max={MAX_TOKENS}
                      step={TOKENS_STEP}
                      marks={TOKEN_MARKS.map((m) => ({ value: m.value, label: m.label }))}
                    />
                  </Box>
                  <Text size="xs" c="dimmed">
                    HTML生成など長い出力が必要な場合は大きな値を設定してください
                  </Text>
                </div>

                <div>
                  <Switch
                    label="クラウドで自動圧縮を有効にする"
                    description={
                      settings.provider === "local" || settings.provider === "ollama"
                        ? "ローカルモデルでは必要時に自動圧縮されます。クラウド向け設定は保存のみ行います"
                        : settings.autoCompact
                          ? "長い会話で構造化要約を自動生成します。追加の LLM コストが発生します"
                          : "デフォルトはOFFです。長期セッションで情報保持を優先したい場合のみ有効にしてください"
                    }
                    checked={settings.autoCompact}
                    onChange={(e) => setSettings({ autoCompact: e.currentTarget.checked })}
                  />
                </div>

                {visibility.showApiKey && (
                  <PasswordInput
                    label="APIキー"
                    placeholder={provider.placeholder}
                    value={settings.apiKey}
                    onChange={(e) => setSettings({ apiKey: e.currentTarget.value })}
                  />
                )}

                {visibility.showBaseUrl && (
                  <TextInput
                    label="エンドポイントURL"
                    description={
                      settings.provider !== "local"
                        ? "空欄の場合は公式エンドポイントを使用"
                        : undefined
                    }
                    placeholder={
                      settings.provider === "local"
                        ? "http://localhost:11434"
                        : "https://proxy.example.com/v1"
                    }
                    value={settings.baseUrl}
                    onChange={(e) => setSettings({ baseUrl: e.currentTarget.value })}
                  />
                )}

                {visibility.showApiMode && (
                  <Select
                    label="APIモード"
                    description="プロキシ経由の場合は Chat Completions を推奨"
                    data={[
                      { value: "auto", label: "自動 (デフォルト)" },
                      {
                        value: "chat-completions",
                        label: "Chat Completions (/v1/chat/completions)",
                      },
                      { value: "responses", label: "Responses (/v1/responses)" },
                    ]}
                    value={settings.apiMode}
                    onChange={(value) => {
                      if (value)
                        setSettings({
                          apiMode: value as "auto" | "chat-completions" | "responses",
                        });
                    }}
                    allowDeselect={false}
                  />
                )}

                {visibility.showOAuth && <OAuthSection />}

                <SaveButton onClick={handleSave} />
              </Stack>
            </Box>
          </Tabs.Panel>

          <Tabs.Panel value="skills" pt="xs" style={{ flex: 1, minHeight: 0 }}>
            <Box style={PANEL_SCROLL_STYLE}>
              <SkillsEditor />
            </Box>
          </Tabs.Panel>

          <Tabs.Panel value="system" pt="xs" style={{ flex: 1, minHeight: 0 }}>
            <Box style={PANEL_SCROLL_STYLE}>
              <Stack gap="md" pb="sm">
                <div>
                  <Switch
                    label="バックグラウンドフェッチを有効にする"
                    description={
                      settings.enableBgFetch
                        ? "AIがWebページを直接取得できます"
                        : "AIによるWebページの直接取得を無効化します"
                    }
                    checked={settings.enableBgFetch}
                    onChange={(e) => setSettings({ enableBgFetch: e.currentTarget.checked })}
                  />
                </div>

                <div>
                  <Switch
                    label="プロンプトインジェクション検知を有効にする"
                    description={
                      settings.enableSecurityMiddleware
                        ? "ツール出力内の不審な指示を検知した場合、実際の内容をAIに渡さずブロック通知のみ返します"
                        : "⚠️ 検知をスキップします。悪意あるWebページの指示をAIが実行してしまうリスクがあります"
                    }
                    checked={settings.enableSecurityMiddleware}
                    onChange={(e) =>
                      setSettings({ enableSecurityMiddleware: e.currentTarget.checked })
                    }
                  />
                </div>

                <div>
                  <Switch
                    label="MCP Server 接続を有効にする"
                    description={
                      settings.enableMcpServer
                        ? "localhost:7331 へのWebSocket接続を試行します"
                        : "外部ツールからの接続を無効化します"
                    }
                    checked={settings.enableMcpServer}
                    onChange={(e) => setSettings({ enableMcpServer: e.currentTarget.checked })}
                  />
                  <Text size="xs" c="dimmed" mt="xs">
                    変更は「保存」ボタンを押した後、拡張機能の再読み込みで反映されます
                  </Text>
                </div>

                <SaveButton onClick={handleSave} />
              </Stack>
            </Box>
          </Tabs.Panel>

          <Tabs.Panel value="security" pt="xs" style={{ flex: 1, minHeight: 0 }}>
            <Box style={PANEL_SCROLL_STYLE}>
              <Stack gap="md" pb="sm">
                <SecurityAuditSettingsSection entries={auditEntries} loading={auditLoading} />
              </Stack>
            </Box>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Drawer>
  );
}
