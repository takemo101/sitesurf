import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import type { ProgressiveLoadingTask } from "@/hooks/use-progressive-loading";

type NamedComponentModule<
  TExportName extends string,
  TComponent extends ComponentType<any>,
> = Record<TExportName, TComponent>;

interface LazyRouteModule<TModule, TComponent extends ComponentType<any>> {
  Component: LazyExoticComponent<TComponent>;
  preload: () => Promise<TModule>;
}

export function createLazyRouteModule<
  TExportName extends string,
  TComponent extends ComponentType<any>,
  TModule extends NamedComponentModule<TExportName, TComponent>,
>(
  loadModule: () => Promise<TModule>,
  exportName: TExportName,
): LazyRouteModule<TModule, TComponent> {
  let pending: Promise<TModule> | undefined;

  const preload = () => {
    pending ??= loadModule().catch((error) => {
      pending = undefined;
      throw error;
    });
    return pending;
  };

  return {
    preload,
    Component: lazy(async () => {
      const module = await preload();
      return {
        default: module[exportName],
      };
    }),
  };
}

const chatRoute = createLazyRouteModule(() => import("@/features/chat/ChatArea"), "ChatArea");
const settingsRoute = createLazyRouteModule(
  () => import("@/features/settings/SettingsPanel"),
  "SettingsPanel",
);
const artifactsRoute = createLazyRouteModule(
  () => import("@/features/artifacts/ArtifactPanel"),
  "ArtifactPanel",
);

export const ChatRoute = chatRoute.Component;
export const SettingsRoute = settingsRoute.Component;
export const ArtifactsRoute = artifactsRoute.Component;

export const preloadChatRoute = chatRoute.preload;
export const preloadSettingsRoute = settingsRoute.preload;
export const preloadArtifactsRoute = artifactsRoute.preload;

export function getProgressiveRouteTasks(): ProgressiveLoadingTask[] {
  return [
    { key: "chat", priority: 2, load: preloadChatRoute },
    { key: "settings", priority: 3, load: preloadSettingsRoute },
    { key: "artifacts", priority: 4, load: preloadArtifactsRoute },
  ];
}
