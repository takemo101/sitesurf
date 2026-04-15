declare namespace chrome.userScripts {
  interface WorldProperties {
    worldId: string;
    messaging?: boolean;
  }

  interface ScriptInjection {
    js: Array<{ code: string }>;
    target: { tabId: number; allFrames?: boolean };
    world: "USER_SCRIPT";
    worldId: string;
    injectImmediately?: boolean;
  }

  interface InjectionResult {
    result: unknown;
  }

  function configureWorld(properties: WorldProperties): Promise<void>;
  function execute(injection: ScriptInjection): Promise<InjectionResult[]>;
}
