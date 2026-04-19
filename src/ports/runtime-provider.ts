import type { BrowserExecutor } from "@/ports/browser-executor";
import type { ArtifactStoragePort } from "@/ports/artifact-storage";
import type { Result, ToolError } from "@/shared/errors";
import type { SkillMatch } from "@/shared/skill-types";

/**
 * RuntimeProviderパターン - 各機能を独立したProviderとして実装
 *
 * 各機能を独立したProviderとして実装し、
 * REPL内で利用可能にする。
 *
 * Benefits:
 * - 責任の分離: 各機能を独立したProviderとして実装
 * - 動的description生成: REPLツールのdescriptionを実行時に動的に構築
 * - 拡張性: 新しい機能の追加が容易
 * - テスト容易性: 各Providerを個別にテスト可能
 *
 * NOTE: REPL 内で AI が呼べる helper 関数の実体 (async function xxx) は
 * `public/sandbox.html` に hardcode されている。provider 側は
 * `handleRequest()` で sandbox から届く sandbox-request を処理する責務のみ。
 * 両者の action 名は `sandbox-contract.test.ts` で drift を検知している。
 */

/**
 * Sandboxからのリクエストメッセージ
 */
export interface SandboxRequest {
  id: string;
  action: string;
  [key: string]: unknown;
}

/**
 * Sandboxへのレスポンス
 */
export interface SandboxResponse {
  id: string;
  ok: boolean;
  value?: unknown;
  error?: string;
}

/**
 * Providerコンテキスト - 実行時に必要な依存関係
 */
export interface ProviderContext {
  browser: BrowserExecutor;
  artifactStorage: ArtifactStoragePort;
  signal?: AbortSignal;
  // browserjs() 実行前に target page の window に skill extractor を注入するために使う。
  // 現在タブの URL にマッチした skill のみが渡される想定。
  skillMatches?: readonly SkillMatch[];
}

/**
 * RuntimeProviderインターフェース
 *
 * 各機能（browserjs, nativeInput, navigate, artifacts）がこのインターフェースを実装する。
 */
export interface RuntimeProvider {
  /**
   * Providerが処理するアクション名のリスト
   */
  readonly actions: readonly string[];

  /**
   * AI向けの説明文を生成
   * システムプロンプトに含まれる関数説明を動的に構築する
   */
  getDescription(): string;

  /**
   * メッセージを処理する
   * @param request Sandboxからのリクエスト
   * @param context 実行コンテキスト
   * @returns 処理結果
   */
  handleRequest(
    request: SandboxRequest,
    context: ProviderContext,
  ): Promise<Result<unknown, ToolError>>;
}

/**
 * Providerレジストリ
 *
 * 複数のProviderを管理し、アクション名で適切なProviderをルーティングする
 */
export class ProviderRegistry {
  private providers: RuntimeProvider[] = [];
  private actionMap = new Map<string, RuntimeProvider>();

  register(provider: RuntimeProvider): void {
    this.providers.push(provider);
    for (const action of provider.actions) {
      this.actionMap.set(action, provider);
    }
  }

  getProvider(action: string): RuntimeProvider | undefined {
    return this.actionMap.get(action);
  }

  getAllProviders(): readonly RuntimeProvider[] {
    return this.providers;
  }

  /**
   * 全Providerのdescriptionを結合して返す
   */
  getCombinedDescription(): string {
    return this.providers.map((p) => p.getDescription()).join("\n\n");
  }
}
