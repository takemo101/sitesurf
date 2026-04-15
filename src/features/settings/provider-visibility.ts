import { PROVIDERS, type ProviderId } from "@/shared/constants";

export interface FieldVisibility {
  showModelSelect: boolean;
  showModelInput: boolean;
  showApiKey: boolean;
  showBaseUrl: boolean;
  showApiMode: boolean;
  showOAuth: boolean;
}

export function getFieldVisibility(providerId: ProviderId): FieldVisibility {
  const provider = PROVIDERS[providerId];
  const hasModelList = provider.models.length > 0;

  // openai-codex は純粋なOAuthプロバイダーなのでAPIキー入力は不要
  const isPureOAuth = providerId === "openai-codex";

  return {
    showModelSelect: hasModelList,
    showModelInput: !hasModelList,
    showApiKey: !isPureOAuth && (provider.authType === "apikey" || provider.authType === "oauth"),
    showBaseUrl: true,
    showApiMode: providerId === "openai" || providerId === "copilot" || providerId === "local",
    showOAuth: provider.authType === "oauth",
  };
}
