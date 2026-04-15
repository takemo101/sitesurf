import { useState } from "react";
import { Badge, Button, Divider, Group, Text, TextInput } from "@mantine/core";

import type { DeviceCodeInfo } from "@/ports/auth-provider";
import { useDeps } from "@/shared/deps-context";
import { useStore } from "@/store";
import { saveSettings } from "./persistence";

import { DeviceCodeDisplay } from "./DeviceCodeDisplay";

import type { AuthFlowStatus } from "@/ports/auth-provider";

type OAuthStatus = "idle" | "logging-in" | "error";

const PROGRESS_LABELS: Record<AuthFlowStatus, string> = {
  starting: "認証を開始中...",
  "waiting-for-user": "ブラウザで認証してください...",
  "exchanging-token": "トークンを取得中...",
  complete: "認証完了",
};

export function OAuthSection() {
  const deps = useDeps();
  const { authProviders } = deps;
  const provider = useStore((s) => s.settings.provider);
  const credentials = useStore((s) => s.settings.credentials);
  const enterpriseDomain = useStore((s) => s.settings.enterpriseDomain);
  const setSettings = useStore((s) => s.setSettings);
  const setCredentials = useStore((s) => s.setCredentials);

  const [status, setStatus] = useState<OAuthStatus>("idle");
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deviceCode, setDeviceCode] = useState<DeviceCodeInfo | null>(null);

  const handleDisconnect = () => {
    setCredentials(null);
    setDeviceCode(null);
    setErrorMessage(null);
    setStatus("idle");
    saveSettings(deps.storage, { ...useStore.getState().settings, credentials: null });
  };

  const handleOAuth = async () => {
    const authProvider = authProviders[provider];
    if (!authProvider) return;

    setStatus("logging-in");
    setErrorMessage(null);
    setProgressLabel(null);
    setDeviceCode(null);

    try {
      const result = await authProvider.login(
        {
          onDeviceCode: (info) => setDeviceCode(info),
          onProgress: (s) => setProgressLabel(PROGRESS_LABELS[s] ?? null),
        },
        provider === "copilot" ? { enterpriseDomain: enterpriseDomain || undefined } : undefined,
      );

      if (result.ok) {
        setCredentials(result.value);
        setStatus("idle");
        setDeviceCode(null);
        setProgressLabel(null);
        saveSettings(deps.storage, useStore.getState().settings);
      } else {
        setErrorMessage(result.error.message);
        setStatus("error");
        setProgressLabel(null);
      }
    } catch (e: unknown) {
      setErrorMessage(
        (e instanceof Error ? e.message : String(e)) || "認証中にエラーが発生しました",
      );
      setStatus("error");
      setProgressLabel(null);
    }
  };

  if (credentials) {
    const isOpenAICodex = provider === "openai-codex";
    return (
      <>
        <Divider label="OAuth" labelPosition="center" />
        <Group gap="xs">
          <Badge color="green" variant="dot">
            接続済み
          </Badge>
          {isOpenAICodex && (
            <Badge color="blue" variant="light" size="sm">
              Codex API 経由
            </Badge>
          )}
          <Button variant="subtle" size="xs" color="red" onClick={handleDisconnect}>
            切断
          </Button>
        </Group>
      </>
    );
  }

  const getLoginButtonText = () => {
    if (provider === "copilot") return "GitHubでログイン";
    if (provider === "openai-codex") return "OpenAIでログイン (Codex)";
    return "OpenAIでログイン";
  };

  return (
    <>
      <Divider label="または" labelPosition="center" />

      {provider === "copilot" && (
        <TextInput
          label="GitHub Enterprise ドメイン (個人版は空欄)"
          placeholder="github.example.com"
          value={enterpriseDomain}
          onChange={(e) => setSettings({ enterpriseDomain: e.currentTarget.value })}
        />
      )}

      <Button variant="light" size="xs" onClick={handleOAuth} loading={status === "logging-in"}>
        {getLoginButtonText()}
      </Button>

      {progressLabel && status === "logging-in" && (
        <Text size="xs" c="dimmed">
          {progressLabel}
        </Text>
      )}

      {deviceCode && <DeviceCodeDisplay deviceCode={deviceCode} />}

      {status === "error" && (
        <Text size="xs" c="red">
          {errorMessage || "認証に失敗しました。再度お試しください。"}
        </Text>
      )}
    </>
  );
}
