import { Select } from "@mantine/core";

import { PROVIDERS, type ProviderId } from "@/shared/constants";
import { useStore } from "@/store";

const PROVIDER_OPTIONS = Object.values(PROVIDERS).map((p) => ({
  value: p.id,
  label: p.name,
}));

export function ProviderSelect() {
  const provider = useStore((s) => s.settings.provider);
  const setSettings = useStore((s) => s.setSettings);

  return (
    <Select
      label="AIプロバイダー"
      data={PROVIDER_OPTIONS}
      value={provider}
      onChange={(value) => {
        if (!value) return;
        const id = value as ProviderId;
        const info = PROVIDERS[id];
        setSettings({
          provider: id,
          model: info.defaultModel,
        });
      }}
      allowDeselect={false}
    />
  );
}
