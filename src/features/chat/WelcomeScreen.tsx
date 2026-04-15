import { Stack, Text, Title, UnstyledButton } from "@mantine/core";
import { SAMPLE_PROMPTS } from "./sample-prompts";

export function WelcomeScreen({ onPromptSelect }: { onPromptSelect: (prompt: string) => void }) {
  return (
    <Stack align="center" justify="center" h="100%" gap="lg" px="md">
      <Stack align="center" gap={4}>
        <Title order={1} size="2.2rem" className="sitesurf-title-ride">
          SiteSurf
        </Title>
        <div className="sitesurf-wave-art" aria-hidden="true">
          <svg viewBox="0 0 220 48" preserveAspectRatio="none">
            <path
              className="sitesurf-wave-line wave-1"
              d="M0 28 C 18 4, 42 46, 66 20 S 118 4, 146 30 S 194 50, 220 24"
            />
            <path
              className="sitesurf-wave-line wave-2"
              d="M0 20 C 22 44, 44 2, 72 28 S 126 44, 154 16 S 196 0, 220 26"
            />
            <path
              className="sitesurf-wave-line wave-3"
              d="M0 30 C 26 8, 56 52, 90 24 S 154 8, 182 34 S 206 46, 220 22"
            />
            <path
              className="sitesurf-wave-line wave-4"
              d="M0 24 C 16 -2, 48 52, 82 18 S 140 -2, 172 30 S 206 54, 220 18"
            />
          </svg>
        </div>
        <Text size="sm" c="dimmed">
          AIと一緒にWebを操作しよう
        </Text>
      </Stack>

      <Stack gap={8} w="100%" maw={320}>
        {SAMPLE_PROMPTS.map((sp) => (
          <UnstyledButton
            key={sp.label}
            onClick={() => onPromptSelect(sp.prompt)}
            px="md"
            py="sm"
            style={{
              border: "1px solid var(--mantine-color-default-border)",
              borderRadius: 20,
              textAlign: "center",
            }}
            className="hover-highlight sample-prompt-pill"
          >
            <Text size="sm">{sp.label}</Text>
          </UnstyledButton>
        ))}
      </Stack>
    </Stack>
  );
}
