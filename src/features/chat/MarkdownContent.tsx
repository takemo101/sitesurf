import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ActionIcon,
  Anchor,
  Blockquote,
  Box,
  Code,
  CopyButton,
  Group,
  Table,
  Text,
  Title,
  useComputedColorScheme,
} from "@mantine/core";
import { Check, Copy } from "lucide-react";
import hljs from "highlight.js";
import "@/shared/hljs-theme.css";

function CodeBlock({ lang, children }: { lang: string; children: string }) {
  const colorScheme = useComputedColorScheme();
  const isDark = colorScheme === "dark";
  const headerBg = isDark ? "var(--mantine-color-dark-5)" : "var(--mantine-color-gray-3)";
  const bodyBg = isDark ? "var(--mantine-color-dark-6)" : "var(--mantine-color-gray-2)";

  const highlighted = hljs.getLanguage(lang)
    ? hljs.highlight(children, { language: lang, ignoreIllegals: true }).value
    : null;

  return (
    <Box
      my={12}
      style={{
        position: "relative",
        borderRadius: 6,
        overflow: "hidden",
      }}
    >
      <Group
        px="xs"
        py={4}
        gap={4}
        style={{
          backgroundColor: headerBg,
        }}
      >
        <Text size="12px" fw={600} c="dimmed" tt="uppercase">
          {lang}
        </Text>
        <Box style={{ flex: 1 }} />
        <CopyButton value={children}>
          {({ copied, copy }) => (
            <ActionIcon variant="subtle" size="xs" onClick={copy} aria-label="コピー">
              {copied ? <Check size={10} /> : <Copy size={10} />}
            </ActionIcon>
          )}
        </CopyButton>
      </Group>
      {highlighted ? (
        <pre
          style={{
            margin: 0,
            padding: "var(--mantine-spacing-sm)",
            fontSize: 13,
            fontFamily: "monospace",
            lineHeight: 1.5,
            overflowX: "auto",
            backgroundColor: bodyBg,
          }}
        >
          <code
            className={`hljs language-${lang}`}
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        </pre>
      ) : (
        <Code
          block
          style={{
            fontSize: 13,
            borderRadius: 0,
            overflowX: "auto",
            whiteSpace: "pre",
            maxWidth: "100%",
            backgroundColor: bodyBg,
          }}
        >
          {children}
        </Code>
      )}
    </Box>
  );
}

const components = {
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    const match = className?.match(/language-(\w+)/);
    const lang = match?.[1];
    if (lang) {
      return <CodeBlock lang={lang}>{String(children)}</CodeBlock>;
    }
    return (
      <Code
        style={{
          fontSize: "0.875em",
          padding: "2px 5px",
          borderRadius: 4,
        }}
      >
        {String(children)}
      </Code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => {
    const colorScheme = useComputedColorScheme();
    const isDark = colorScheme === "dark";
    const bodyBg = isDark ? "var(--mantine-color-dark-6)" : "var(--mantine-color-gray-2)";
    const bodyColor = isDark ? "var(--mantine-color-dark-0)" : "var(--mantine-color-gray-8)";

    return (
      <Box
        my={12}
        style={{
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        <Code
          block
          style={{
            overflowX: "auto",
            whiteSpace: "pre",
            maxWidth: "100%",
            backgroundColor: bodyBg,
            borderRadius: 0,
            fontSize: 13,
            color: bodyColor,
          }}
        >
          {children}
        </Code>
      </Box>
    );
  },
  p: ({ children }: { children?: React.ReactNode }) => (
    <Text size="sm" mb={12} style={{ lineHeight: 1.7 }}>
      {children}
    </Text>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <Box
      component="ul"
      ml="md"
      my={8}
      style={{ fontSize: "var(--mantine-font-size-sm)", lineHeight: 1.7 }}
    >
      {children}
    </Box>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <Box
      component="ol"
      ml="md"
      my={8}
      style={{ fontSize: "var(--mantine-font-size-sm)", lineHeight: 1.7 }}
    >
      {children}
    </Box>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <Box component="li" mb={4}>
      {children}
    </Box>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <Anchor href={href} target="_blank" size="sm">
      {children}
    </Anchor>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => (
    <Title order={4} mt={20} mb={8}>
      {children}
    </Title>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <Title order={5} mt={16} mb={8}>
      {children}
    </Title>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <Title order={6} mt={12} mb={6}>
      {children}
    </Title>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <Box
      my={12}
      className="markdown-table-wrapper"
      style={{
        overflowX: "auto",
        borderRadius: 6,
        border: "1px solid var(--mantine-color-default-border)",
      }}
    >
      <Table
        striped
        highlightOnHover
        style={{
          fontSize: "var(--mantine-font-size-sm)",
          whiteSpace: "nowrap",
        }}
      >
        {children}
      </Table>
    </Box>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <Table.Th
      style={{
        fontWeight: 600,
        fontSize: "var(--mantine-font-size-xs)",
        textTransform: "uppercase",
        letterSpacing: "0.03em",
        color: "var(--mantine-color-dimmed)",
        padding: "8px 12px",
        borderBottom: "2px solid var(--mantine-color-default-border)",
      }}
    >
      {children}
    </Table.Th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <Table.Td style={{ padding: "8px 12px" }}>{children}</Table.Td>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <Blockquote
      color="gray"
      my={12}
      style={{ fontSize: "var(--mantine-font-size-sm)", lineHeight: 1.7 }}
    >
      {children}
    </Blockquote>
  ),
  hr: () => (
    <Box
      component="hr"
      my={16}
      style={{
        border: "none",
        borderTop: "1px solid var(--mantine-color-default-border)",
      }}
    />
  ),
};

export function MarkdownContent({ content }: { content: string }) {
  return (
    <Box className="markdown-content">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </Markdown>
    </Box>
  );
}
