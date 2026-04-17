import { createContext, useContext } from "react";
import type { AIProvider, ProviderConfig } from "@/ports/ai-provider";
import type { ArtifactStoragePort } from "@/ports/artifact-storage";
import type { AuthProvider } from "@/ports/auth-provider";
import type { BrowserExecutor } from "@/ports/browser-executor";
import type { StoragePort } from "@/ports/storage";
import type { SessionStoragePort } from "@/ports/session-storage";
import type { ToolResultStorePort } from "@/ports/tool-result-store";

export interface AppDeps {
  createAIProvider: (config: ProviderConfig) => AIProvider;
  authProviders: Record<string, AuthProvider>;
  browserExecutor: BrowserExecutor;
  storage: StoragePort;
  sessionStorage: SessionStoragePort;
  artifactStorage: ArtifactStoragePort;
  toolResultStore: ToolResultStorePort;
}

const DepsContext = createContext<AppDeps | null>(null);

export const DepsProvider = DepsContext.Provider;

export function useDeps(): AppDeps {
  const deps = useContext(DepsContext);
  if (!deps) throw new Error("DepsProvider not found. Wrap App with DepsProvider.");
  return deps;
}
