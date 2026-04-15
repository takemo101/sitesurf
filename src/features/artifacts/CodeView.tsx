import { Box, useComputedColorScheme } from "@mantine/core";
import hljs from "highlight.js";
import "@/shared/hljs-theme.css";

interface CodeViewProps {
  content?: string;
  filename?: string;
}

function getLanguageFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const languageMap: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    json: "json",
    py: "python",
    md: "markdown",
    svg: "xml",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    sh: "bash",
    bash: "bash",
    sql: "sql",
    java: "java",
    c: "c",
    cpp: "cpp",
    cs: "csharp",
    go: "go",
    rs: "rust",
    php: "php",
    rb: "ruby",
    swift: "swift",
    kt: "kotlin",
    r: "r",
  };
  return languageMap[ext] || "plaintext";
}

export function CodeView({ content = "", filename }: CodeViewProps) {
  const colorScheme = useComputedColorScheme();
  const isDark = colorScheme === "dark";
  const language = getLanguageFromFilename(filename || "");

  const highlighted = hljs.highlight(content, {
    language,
    ignoreIllegals: true,
  }).value;

  return (
    <Box
      h="100%"
      style={{
        overflow: "auto",
        background: isDark ? "var(--mantine-color-dark-6)" : "var(--mantine-color-gray-2)",
      }}
    >
      <pre
        style={{
          margin: 0,
          padding: "var(--mantine-spacing-sm)",
          fontSize: 12,
          fontFamily: "monospace",
          lineHeight: 1.5,
          color: isDark ? "var(--mantine-color-dark-0)" : "var(--mantine-color-gray-8)",
        }}
      >
        <code
          className={`hljs language-${language}`}
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
    </Box>
  );
}
