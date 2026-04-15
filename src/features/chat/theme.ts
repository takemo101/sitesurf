export const messageStyles = {
  user: {
    bg: "var(--mantine-color-indigo-light)",
    borderColor: "var(--mantine-color-indigo-outline)",
  },
  assistant: {
    bg: "transparent",
    borderColor: "transparent",
  },
  system: {
    bg: "transparent",
    borderColor: "transparent",
  },
  error: {
    bg: "var(--mantine-color-red-light)",
    borderColor: "var(--mantine-color-red-outline)",
  },
} as const;

export type StyledRole = keyof typeof messageStyles;
