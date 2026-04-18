const BG_FETCH_HELPER_DESCRIPTION_LINES = [
  "## bgFetch(url, options?)",
  "",
  "詳しい使い分けは top-level `bg_fetch` tool description を参照。`enableBgFetch` トグルも top-level `bg_fetch` と共有し、無効時は `bgFetch` も使えない。",
  "",
  "### Signature",
  "```ts",
  "bgFetch(url: string, options?: {",
  '  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS",',
  "  headers?: Record<string, string>,",
  "  body?: string,",
  '  responseType?: "text" | "json" | "base64" | "readability",  // default: "text"',
  "  timeout?: number,  // ms, default 30000, max 60000",
  "}): Promise<{",
  "  url: string, ok: boolean, status: number, statusText: string,",
  "  headers: Record<string, string>, body: string | object,",
  "  redirected?: boolean, redirectUrl?: string,",
  "}>",
  "```",
];

export function buildBgFetchHelperDescription(): string {
  return BG_FETCH_HELPER_DESCRIPTION_LINES.join("\n");
}
