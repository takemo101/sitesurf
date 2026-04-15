import type { BrowserError, Result, ToolError } from "@/shared/errors";

export interface BrowserExecutor {
  // --- タブ操作 ---
  getActiveTab(): Promise<TabInfo>;
  openTab(url: string): Promise<number>;
  navigateTo(tabId: number, url: string): Promise<Result<NavigationResult, BrowserError>>;
  captureScreenshot(): Promise<string>;
  onTabActivated(callback: (tabId: number) => void): Unsubscribe;
  onTabUpdated(callback: (tabId: number, url: string) => void): Unsubscribe;
  onTabRemoved(callback: (tabId: number) => void): Unsubscribe;

  // --- ページ操作 ---
  readPageContent(tabId: number, maxDepth?: number): Promise<Result<PageContent, BrowserError>>;
  executeScript(
    tabId: number,
    code: string,
    signal?: AbortSignal,
  ): Promise<Result<ScriptResult, ToolError>>;
  injectElementPicker(
    tabId: number,
    message?: string,
  ): Promise<Result<ElementInfo | null, BrowserError>>;
}

export type Unsubscribe = () => void;

export interface TabInfo {
  id: number | null;
  url: string;
  title: string;
}

export interface NavigationResult {
  url: string;
  title: string;
}

export interface PageContent {
  text: string;
  simplifiedDom: string;
}

export interface ScriptResult {
  value: unknown;
}

export interface ElementInfo {
  selector: string;
  tagName: string;
  text: string;
  html: string;
  attributes: Record<string, string>;
  boundingBox: { x: number; y: number; width: number; height: number };
  surroundingHTML: string;
}
