import type { ToolDefinition } from "@/ports/ai-provider";
import type { StoragePort } from "@/ports/storage";
import type { Result, ToolError } from "@/shared/errors";
import { err, ok } from "@/shared/errors";
import {
  SKILL_DRAFTS_STORAGE_KEY,
  type SkillDraftIssue,
  type SkillDraftValidation,
  type StoredSkillDraft,
} from "@/shared/skill-draft-types";
import { SkillRegistry } from "@/shared/skill-registry";
import {
  normalizeLegacyExtractorCode,
  validateSkillDraftDefinition,
} from "@/shared/skill-validation";
import { renderSkillMarkdown } from "@/shared/skill-markdown";
import type { Skill, SkillExtractor, SkillMatchers, SkillScope } from "@/shared/skill-types";
import { CUSTOM_SKILLS_STORAGE_KEY } from "./skills/skill-loader";

// ============ Action Types ============

export type SkillAction =
  | { action: "list"; url?: string }
  | { action: "get"; id: string; includeLibraryCode?: boolean }
  | { action: "create"; data: Skill }
  | { action: "update"; id: string; updates: Partial<Skill> }
  | { action: "patch"; id: string; patches: SkillPatches }
  | { action: "delete"; id: string }
  | { action: "list_drafts" }
  | { action: "create_draft"; data: CreateSkillDraftArgs }
  | { action: "update_draft"; id: string; updates: Partial<CreateSkillDraftArgs> }
  | { action: "delete_draft"; id: string };

export type SkillPatches = {
  [K in keyof Skill]?: {
    old_string: string;
    new_string: string;
  };
} & {
  // Allow dynamic extractor paths like "extractors.{id}.{field}"
  [key: `extractors.${string}.${string}`]: {
    old_string: string;
    new_string: string;
  };
};

// ============ Result Types ============

export interface SkillListResult {
  skills: Array<{
    id: string;
    name: string;
    description: string;
    scope?: Skill["scope"];
    matchers: {
      hosts: string[];
      paths?: string[];
    };
    extractors: Array<{
      id: string;
      name: string;
      description: string;
      outputSchema: string;
    }>;
  }>;
}

export interface SkillGetResult {
  skill: Skill;
}

export interface SkillCreateResult {
  skill: Skill;
}

export interface SkillUpdateResult {
  skill: Skill;
}

export interface SkillDeleteResult {
  deleted: true;
  id: string;
}

export interface CreateSkillDraftArgs {
  name: string;
  description: string;
  scope?: SkillScope;
  matchers: SkillMatchers;
  extractors: SkillExtractor[];
  instructionsMarkdown?: string;
}

export interface CreateSkillDraftResult {
  draftId: string;
  normalizedSkill: Skill;
  validation: SkillDraftValidation;
  suggestedFixes: string[];
}

export interface UpdateSkillDraftArgs {
  draftId: string;
  updates: Partial<CreateSkillDraftArgs>;
}

export interface UpdateSkillDraftResult {
  draftId: string;
  normalizedSkill: Skill;
  validation: SkillDraftValidation;
  suggestedFixes: string[];
}

export interface ListSkillDraftsResult {
  drafts: Array<{
    draftId: string;
    name: string;
    description: string;
    scope: SkillScope;
    skillId: string;
    validation: SkillDraftValidation;
    suggestedFixes: string[];
    createdAt: string;
    updatedAt: string;
  }>;
}

export interface DeleteSkillDraftArgs {
  draftId: string;
}

export interface DeleteSkillDraftResult {
  deleted: true;
  draftId: string;
}

export type SkillResult =
  | SkillListResult
  | SkillGetResult
  | SkillCreateResult
  | SkillUpdateResult
  | SkillDeleteResult
  | CreateSkillDraftResult
  | UpdateSkillDraftResult
  | ListSkillDraftsResult
  | DeleteSkillDraftResult;

// ============ Tool Definition ============

export const skillToolDef: ToolDefinition = {
  name: "skill",
  description: `サイト固有の自動化ライブラリ（Skill）を管理するツール。

## アクション

### 1. list - スキル一覧
現在のタブURLまたは指定URLにマッチするスキルを一覧表示する。

call skill({ action: "list" }) - 現在のタブにマッチするスキル
call skill({ action: "list", url: "https://youtube.com" }) - 特定URLにマッチするスキル
call skill({ action: "list", url: "" }) - すべてのスキル

### 2. get - スキル詳細
指定したIDのスキル詳細を取得する。library codeはデフォルトで除外される。

call skill({ action: "get", id: "youtube-extractor" })
call skill({ action: "get", id: "youtube-extractor", includeLibraryCode: true })

### 3. create - スキル作成
新しいスキルを作成する。IDは一意である必要がある。

call skill({
  action: "create",
  data: {
    id: "example-skill",
    name: "Example Skill",
    description: "説明文",
    matchers: { hosts: ["example.com"] },
    version: "0.0.0",
    extractors: [{
      id: "getTitle",
      name: "タイトル取得",
      description: "ページタイトルを取得",
      code: "function () { return document.title; }",
      outputSchema: "string"
    }]
  }
})

### 4. update - スキル更新（部分更新）
特定フィールドを更新する。extractors全体を置き換える場合に使用。

call skill({
  action: "update",
  id: "example-skill",
  updates: {
    description: "新しい説明",
    matchers: { hosts: ["example.com", "www.example.com"] }
  }
})

### 5. patch - スキルパッチ（文字列置換）
コードの一部を修正する。セレクター変更など小さな修正に適している。

call skill({
  action: "patch",
  id: "example-skill",
  patches: {
    "extractors.getTitle.code": {
      old_string: "document.title",
      new_string: "document.querySelector('h1')?.textContent"
    }
  }
})

### 6. delete - スキル削除
指定したIDのスキルを削除する。

call skill({ action: "delete", id: "old-skill" })

### 7. list_drafts - 承認待ち下書き一覧
承認待ちの Skill 下書き一覧を取得する。update_draft / delete_draft に使う下書き ID も返す。

call skill({ action: "list_drafts" })

### 8. create_draft - スキル下書き作成
チャットから Skill の下書きを作成する。下書きとして保存されるが、custom skill としては保存されません。
validation 結果を返し、Settings の下書き一覧で内容を確認したうえで明示承認した時だけ custom skill に反映される。

call skill({
  action: "create_draft",
  data: {
    name: "Example Draft Skill",
    description: "説明文",
    scope: "site",
    matchers: { hosts: ["example.com"] },
    extractors: [{
      id: "getTitle",
      name: "タイトル取得",
      description: "ページタイトルを取得",
      code: "function () { return document.title; }",
      outputSchema: "string"
    }]
  }
})

### 9. update_draft - 下書き更新
指定した下書き ID に部分更新を適用する。matchers はフィールド単位でマージ、extractors は指定時に全置換。

call skill({
  action: "update_draft",
  id: "draft-id",
  updates: { description: "より具体的な説明" }
})

### 10. delete_draft - 下書き破棄
指定した下書き ID の承認待ち Skill 下書きを削除する。

call skill({ action: "delete_draft", id: "draft-id" })

## 下書きバリデーション

### reject になるエラー（必ず回避すること）
- code 内で **ナビゲーション操作は禁止**: window.location, location.href=, location.assign(), location.replace(), location.reload(), history.pushState(), history.replaceState()
- code 内で **危険な関数は禁止**: eval(), Function(), new Function(), setTimeout("string"), document.write(), .constructor.constructor(), .submit(), new Image()
- scope が "site" のとき **matchers.hosts は必須**で1つ以上のホストが必要
- 各 extractor に **id, name, description, code, outputSchema** はすべて必須
- **括弧の対応が不一致**（(), [], {} のバランス）

### warning（承認可能だが品質向上のため推奨）
- description が **10文字未満**だと警告 → 用途がわかる具体的な説明にする
- outputSchema が "unknown" だと警告 → 返却値の型を具体的に記述する（例: "{ title: string, url: string }"）
- code に **return 文がない**と警告 → 明示的に return で結果を返す
- code 内の fetch(), XMLHttpRequest, WebSocket は警告（使用可能だが注意）

### 自動補正
- code が bare code（return document.title; など）の場合は自動的に function () { ... } でラップされる
- matchers.hosts は自動的に小文字に正規化される
- name から id が自動生成される（英数字・ハイフンのスラッグ化）`,
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: [
          "list",
          "get",
          "create",
          "update",
          "patch",
          "delete",
          "list_drafts",
          "create_draft",
          "update_draft",
          "delete_draft",
        ],
        description: "実行するアクション",
      },
      url: {
        type: "string",
        description: "listアクションで使用。マッチング対象のURL。空文字ですべてのスキルを表示。",
      },
      id: {
        type: "string",
        description:
          "get/update/patch/delete では対象スキル ID、update_draft/delete_draft では対象下書き ID。",
      },
      includeLibraryCode: {
        type: "boolean",
        description: "getアクションで使用。trueの場合、extractorのcodeも含める。",
      },
      data: {
        type: "object",
        description: "create では作成するスキルデータ、create_draft では作成する下書きデータ。",
      },
      updates: {
        type: "object",
        description: "update または update_draft で使用。更新するフィールド。",
      },
      patches: {
        type: "object",
        description: "patchアクションで使用。文字列置換のパッチ。",
      },
    },
    required: ["action"],
  },
};

// ============ Execute Function ============

function invalidSkillArgs(message: string): Result<never, ToolError> {
  return err({ code: "tool_script_error", message });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function executeSkill(
  storage: StoragePort,
  registry: SkillRegistry,
  currentUrl: string | undefined,
  args: SkillAction,
): Promise<Result<SkillResult, ToolError>> {
  if (typeof args !== "object" || args === null || typeof args.action !== "string") {
    return err({
      code: "tool_script_error",
      message: "skill arguments must be an object with action",
    });
  }

  switch (args.action) {
    case "list":
      return executeList(registry, args.url ?? currentUrl);
    case "get":
      return executeGet(registry, args.id, args.includeLibraryCode ?? false);
    case "create":
      return isPlainObject(args.data)
        ? executeCreate(storage, registry, args.data as Skill)
        : invalidSkillArgs("create action requires data");
    case "update":
      return typeof args.id === "string" && isPlainObject(args.updates)
        ? executeUpdate(storage, registry, args.id, args.updates as Partial<Skill>)
        : invalidSkillArgs("update action requires id and updates");
    case "patch":
      return typeof args.id === "string" && isPlainObject(args.patches)
        ? executePatch(storage, registry, args.id, args.patches as SkillPatches)
        : invalidSkillArgs("patch action requires id and patches");
    case "delete":
      return typeof args.id === "string"
        ? executeDelete(storage, registry, args.id)
        : invalidSkillArgs("delete action requires id");
    case "list_drafts":
      return executeListSkillDrafts(storage);
    case "create_draft":
      return isPlainObject(args.data)
        ? executeCreateSkillDraft(storage, registry, args.data as CreateSkillDraftArgs)
        : invalidSkillArgs("create_draft action requires data");
    case "update_draft":
      return typeof args.id === "string" && isPlainObject(args.updates)
        ? executeUpdateSkillDraft(storage, registry, {
            draftId: args.id,
            updates: args.updates as Partial<CreateSkillDraftArgs>,
          })
        : invalidSkillArgs("update_draft action requires id and updates");
    case "delete_draft":
      return typeof args.id === "string"
        ? executeDeleteSkillDraft(storage, { draftId: args.id })
        : invalidSkillArgs("delete_draft action requires id");
    default:
      return err({
        code: "tool_script_error",
        message: `Unknown action: ${(args as { action: string }).action}`,
      });
  }
}

export async function executeCreateSkillDraft(
  storage: StoragePort,
  registry: SkillRegistry,
  args: CreateSkillDraftArgs,
): Promise<Result<CreateSkillDraftResult, ToolError>> {
  const parsedArgs = parseCreateSkillDraftArgs(args);
  if (!parsedArgs.ok) {
    return err({
      code: "tool_script_error",
      message: parsedArgs.error,
    });
  }

  const normalizedSkill = normalizeDraftSkill(parsedArgs.value);
  const existingDrafts = (await storage.get<StoredSkillDraft[]>(SKILL_DRAFTS_STORAGE_KEY)) ?? [];
  const validation = validateDraftAgainstRegistry(registry, normalizedSkill, existingDrafts);
  const suggestedFixes = buildSuggestedFixes(validation);
  const draftId = crypto.randomUUID();
  const now = new Date().toISOString();
  const draft: StoredSkillDraft = {
    draftId,
    normalizedSkill,
    validation,
    suggestedFixes,
    source: "chat",
    createdAt: now,
    updatedAt: now,
  };

  const saveError = await saveSkillDraftToStorage(storage, { type: "append", draft });
  if (saveError) {
    return err({
      code: "tool_script_error",
      message: saveError,
    });
  }

  return ok({
    draftId,
    normalizedSkill,
    validation,
    suggestedFixes,
  });
}

export async function executeListSkillDrafts(
  storage: StoragePort,
): Promise<Result<ListSkillDraftsResult, ToolError>> {
  const drafts = (await storage.get<StoredSkillDraft[]>(SKILL_DRAFTS_STORAGE_KEY)) ?? [];

  return ok({
    drafts: drafts.map((d) => ({
      draftId: d.draftId,
      name: d.normalizedSkill.name,
      description: d.normalizedSkill.description,
      scope: d.normalizedSkill.scope ?? "site",
      skillId: d.normalizedSkill.id,
      validation: d.validation,
      suggestedFixes: d.suggestedFixes,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    })),
  });
}

export async function executeUpdateSkillDraft(
  storage: StoragePort,
  registry: SkillRegistry,
  args: UpdateSkillDraftArgs,
): Promise<Result<UpdateSkillDraftResult, ToolError>> {
  if (typeof args.draftId !== "string" || args.draftId.trim() === "") {
    return err({
      code: "tool_script_error",
      message: "draftId must be a non-empty string",
    });
  }

  if (typeof args.updates !== "object" || args.updates === null) {
    return err({
      code: "tool_script_error",
      message: "updates must be an object",
    });
  }

  const drafts = (await storage.get<StoredSkillDraft[]>(SKILL_DRAFTS_STORAGE_KEY)) ?? [];
  const draftIndex = drafts.findIndex((d) => d.draftId === args.draftId);

  if (draftIndex === -1) {
    return err({
      code: "tool_script_error",
      message: `Draft not found: ${args.draftId}`,
    });
  }

  const existingDraft = drafts[draftIndex];
  const existingSkill = existingDraft.normalizedSkill;

  // Merge updates into a CreateSkillDraftArgs shape for validation
  const mergedArgs: CreateSkillDraftArgs = {
    name: args.updates.name ?? existingSkill.name,
    description: args.updates.description ?? existingSkill.description,
    scope: args.updates.scope ?? existingSkill.scope,
    matchers: args.updates.matchers
      ? { ...existingSkill.matchers, ...args.updates.matchers }
      : existingSkill.matchers,
    extractors: args.updates.extractors ?? existingSkill.extractors,
    instructionsMarkdown: args.updates.instructionsMarkdown ?? existingSkill.instructionsMarkdown,
  };

  const parsedArgs = parseCreateSkillDraftArgs(mergedArgs);
  if (!parsedArgs.ok) {
    return err({
      code: "tool_script_error",
      message: parsedArgs.error,
    });
  }

  const normalizedSkill = normalizeDraftSkill(parsedArgs.value);
  const validation = validateDraftAgainstRegistry(registry, normalizedSkill, drafts, args.draftId);
  const suggestedFixes = buildSuggestedFixes(validation);

  const updatedDraft: StoredSkillDraft = {
    ...existingDraft,
    normalizedSkill,
    validation,
    suggestedFixes,
    updatedAt: new Date().toISOString(),
  };

  const saveError = await saveSkillDraftToStorage(storage, { type: "upsert", draft: updatedDraft });
  if (saveError) {
    return err({
      code: "tool_script_error",
      message: saveError,
    });
  }

  return ok({
    draftId: args.draftId,
    normalizedSkill,
    validation,
    suggestedFixes,
  });
}

export async function executeDeleteSkillDraft(
  storage: StoragePort,
  args: DeleteSkillDraftArgs,
): Promise<Result<DeleteSkillDraftResult, ToolError>> {
  if (typeof args !== "object" || args === null) {
    return err({
      code: "tool_script_error",
      message: 'skill(action: "delete_draft") arguments must be an object',
    });
  }

  if (typeof args.draftId !== "string" || args.draftId.trim() === "") {
    return err({
      code: "tool_script_error",
      message: "draftId must be a non-empty string",
    });
  }

  const drafts = (await storage.get<StoredSkillDraft[]>(SKILL_DRAFTS_STORAGE_KEY)) ?? [];
  const draftExists = drafts.some((d) => d.draftId === args.draftId);

  if (!draftExists) {
    return err({
      code: "tool_script_error",
      message: `Draft not found: ${args.draftId}`,
    });
  }

  const remainingDrafts = drafts.filter((draft) => draft.draftId !== args.draftId);
  const saveError = await saveSkillDraftToStorage(storage, {
    type: "replaceAll",
    drafts: remainingDrafts,
  });
  if (saveError) {
    return err({
      code: "tool_script_error",
      message: saveError,
    });
  }

  return ok({
    deleted: true,
    draftId: args.draftId,
  });
}

// ============ Action Implementations ============

function executeList(
  registry: SkillRegistry,
  url: string | undefined,
): Result<SkillListResult, ToolError> {
  let skills: Skill[];

  if (url === undefined || url === "") {
    // すべてのスキルを取得
    skills = registry.getAll();
  } else {
    // URLにマッチするスキルを取得
    const matches = registry.getAvailableSkills(url);
    skills = matches.map((m) => m.skill);
  }

  const result: SkillListResult = {
    skills: skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      scope: skill.scope,
      matchers: {
        hosts: skill.matchers.hosts,
        paths: skill.matchers.paths,
      },
      extractors: skill.extractors.map((ext) => ({
        id: ext.id,
        name: ext.name,
        description: ext.description,
        outputSchema: ext.outputSchema,
      })),
    })),
  };

  return ok(result);
}

function executeGet(
  registry: SkillRegistry,
  id: string,
  includeLibraryCode: boolean,
): Result<SkillGetResult, ToolError> {
  const skill = registry.get(id);

  if (!skill) {
    return err({
      code: "tool_script_error",
      message: `Skill not found: ${id}`,
    });
  }

  if (!includeLibraryCode) {
    // codeフィールドを除外したコピーを返す
    const skillWithoutCode: Skill = {
      ...skill,
      extractors: skill.extractors.map((ext) => ({
        ...ext,
        code: "",
      })),
    };
    return ok({ skill: skillWithoutCode });
  }

  return ok({ skill });
}

async function executeCreate(
  storage: StoragePort,
  registry: SkillRegistry,
  data: Skill,
): Promise<Result<SkillCreateResult, ToolError>> {
  // バリデーション
  const validationError = validateSkill(data);
  if (validationError) {
    return err({
      code: "tool_script_error",
      message: validationError,
    });
  }

  // IDの重複チェック
  if (registry.get(data.id)) {
    return err({
      code: "tool_script_error",
      message: `Skill with id '${data.id}' already exists`,
    });
  }

  // レジストリに登録
  registry.register(data);

  // ストレージに保存
  const saveError = await saveCustomSkillsToStorage(storage, {
    type: "upsert",
    skill: data,
  });
  if (saveError) {
    return err({
      code: "tool_script_error",
      message: saveError,
    });
  }

  return ok({ skill: data });
}

async function executeUpdate(
  storage: StoragePort,
  registry: SkillRegistry,
  id: string,
  updates: Partial<Skill>,
): Promise<Result<SkillUpdateResult, ToolError>> {
  const existingSkill = registry.get(id);

  if (!existingSkill) {
    return err({
      code: "tool_script_error",
      message: `Skill not found: ${id}`,
    });
  }

  // 更新を適用
  const updatedSkill: Skill = {
    ...existingSkill,
    ...updates,
    // ネストされたmatchersもマージ
    matchers: updates.matchers
      ? { ...existingSkill.matchers, ...updates.matchers }
      : existingSkill.matchers,
  };

  // extractorsが指定された場合は完全に置き換え
  if (updates.extractors) {
    updatedSkill.extractors = updates.extractors;
  }

  // バリデーション
  const validationError = validateSkill(updatedSkill);
  if (validationError) {
    return err({
      code: "tool_script_error",
      message: validationError,
    });
  }

  if (updatedSkill.id !== id && registry.get(updatedSkill.id)) {
    return err({
      code: "tool_script_error",
      message: `Skill with id '${updatedSkill.id}' already exists`,
    });
  }

  // レジストリを更新（削除して再登録）
  registry.delete(id);
  registry.register(updatedSkill);

  // ストレージに保存
  const saveError = await saveCustomSkillsToStorage(storage, {
    type: "upsert",
    skill: updatedSkill,
    previousId: id,
  });
  if (saveError) {
    return err({
      code: "tool_script_error",
      message: saveError,
    });
  }

  return ok({ skill: updatedSkill });
}

async function executePatch(
  storage: StoragePort,
  registry: SkillRegistry,
  id: string,
  patches: SkillPatches,
): Promise<Result<SkillUpdateResult, ToolError>> {
  const skill = registry.get(id);

  if (!skill) {
    return err({
      code: "tool_script_error",
      message: `Skill not found: ${id}`,
    });
  }

  // patchesを適用したコピーを作成
  let patchedSkill: Skill = JSON.parse(JSON.stringify(skill));

  for (const [key, patch] of Object.entries(patches)) {
    if (!patch) continue;

    const { old_string, new_string } = patch;

    if (key.startsWith("extractors.")) {
      // extractorsの特定フィールドをパッチ
      const parts = key.split(".");
      if (parts.length === 3) {
        const extractorId = parts[1];
        const field = parts[2] as keyof SkillExtractor;
        const extractorIndex = patchedSkill.extractors.findIndex((e) => e.id === extractorId);

        if (extractorIndex === -1) {
          return err({
            code: "tool_script_error",
            message: `Extractor not found: ${extractorId}`,
          });
        }

        const extractor = patchedSkill.extractors[extractorIndex];
        const currentValue = extractor[field];

        if (typeof currentValue !== "string") {
          return err({
            code: "tool_script_error",
            message: `Field ${field} is not a string`,
          });
        }

        if (!currentValue.includes(old_string)) {
          return err({
            code: "tool_script_error",
            message: `Old string not found in ${key}: ${old_string}`,
          });
        }

        (extractor[field] as string) = currentValue.replace(old_string, new_string);
      }
    } else {
      // トップレベルのフィールドをパッチ
      const currentValue = patchedSkill[key as keyof Skill];

      if (typeof currentValue !== "string") {
        return err({
          code: "tool_script_error",
          message: `Field ${key} is not a string`,
        });
      }

      if (!currentValue.includes(old_string)) {
        return err({
          code: "tool_script_error",
          message: `Old string not found in ${key}: ${old_string}`,
        });
      }

      (patchedSkill[key as keyof Skill] as string) = currentValue.replace(old_string, new_string);
    }
  }

  // バリデーション
  const validationError = validateSkill(patchedSkill);
  if (validationError) {
    return err({
      code: "tool_script_error",
      message: validationError,
    });
  }

  // レジストリを更新
  registry.delete(id);
  registry.register(patchedSkill);

  // ストレージに保存
  const saveError = await saveCustomSkillsToStorage(storage, {
    type: "upsert",
    skill: patchedSkill,
  });
  if (saveError) {
    return err({
      code: "tool_script_error",
      message: saveError,
    });
  }

  return ok({ skill: patchedSkill });
}

async function executeDelete(
  storage: StoragePort,
  registry: SkillRegistry,
  id: string,
): Promise<Result<SkillDeleteResult, ToolError>> {
  const existingSkill = registry.get(id);

  if (!existingSkill) {
    return err({
      code: "tool_script_error",
      message: `Skill not found: ${id}`,
    });
  }

  // レジストリから削除
  registry.delete(id);

  // ストレージに保存
  const saveError = await saveCustomSkillsToStorage(storage, {
    type: "delete",
    id,
  });
  if (saveError) {
    return err({
      code: "tool_script_error",
      message: saveError,
    });
  }

  return ok({ deleted: true, id });
}

// ============ Helper Functions ============

function validateSkill(skill: Skill): string | null {
  const validation = validateSkillDraftDefinition(skill);
  if (validation.status === "reject") {
    return validation.errors.map((error) => error.message).join("; ");
  }

  return null;
}

function normalizeDraftSkill(args: CreateSkillDraftArgs): Skill {
  const trimmedName = (args.name ?? "").trim();
  const generatedId = slugifySkillId(trimmedName || "skill-draft");
  const instructions = (args.instructionsMarkdown ?? "").trim();

  const skill: Skill = {
    id: generatedId,
    name: trimmedName,
    description: (args.description ?? "").trim(),
    scope: args.scope ?? "site",
    matchers: {
      hosts: normalizeHosts(args.matchers.hosts),
      ...(args.matchers.paths ? { paths: normalizeStringList(args.matchers.paths) } : {}),
      ...(args.matchers.signals ? { signals: normalizeStringList(args.matchers.signals) } : {}),
    },
    version: "0.0.0",
    extractors: (args.extractors ?? []).map((extractor) => ({
      id: (extractor.id ?? "").trim(),
      name: (extractor.name ?? "").trim(),
      description: (extractor.description ?? "").trim(),
      selector: extractor.selector,
      code: normalizeLegacyExtractorCode(extractor.code ?? ""),
      outputSchema: (extractor.outputSchema ?? "").trim(),
    })),
  };

  if (instructions.length > 0) {
    skill.instructionsMarkdown = instructions;
  }

  return skill;
}

function validateDraftAgainstRegistry(
  registry: SkillRegistry,
  skill: Skill,
  existingDrafts: StoredSkillDraft[] = [],
  excludeDraftId?: string,
): SkillDraftValidation {
  const validation = validateSkillDraftDefinition(skill);
  const errors: SkillDraftIssue[] = [...validation.errors];
  const warnings: SkillDraftIssue[] = [...validation.warnings];

  if (registry.get(skill.id)) {
    errors.push({
      type: "conflict",
      message: `Skill with id '${skill.id}' already exists`,
    });
  }

  const conflictingDraft = existingDrafts.find(
    (d) => d.normalizedSkill.id === skill.id && d.draftId !== excludeDraftId,
  );
  if (conflictingDraft) {
    errors.push({
      type: "conflict",
      message: `Another draft '${conflictingDraft.normalizedSkill.name}' already uses id '${skill.id}'`,
    });
  }

  return {
    status: errors.length > 0 ? "reject" : warnings.length > 0 ? "warning" : "ok",
    errors,
    warnings,
  };
}

function buildSuggestedFixes(validation: SkillDraftValidation): string[] {
  const fixes = new Set<string>();
  const issues = [...validation.errors, ...validation.warnings];

  for (const issue of issues) {
    if (issue.message.includes("already exists")) {
      fixes.add("Skill id を変更して既存スキルと衝突しない名前にしてください。");
    }

    if (issue.message.includes("Another draft")) {
      fixes.add("他の下書きと同じ名前（id）になっています。名前を変更してください。");
    }

    if (issue.message.includes("Forbidden navigation pattern")) {
      fixes.add(
        "window.location や navigate() は使わず、必要なら navigate ツールへ責務を分離してください。",
      );
    }

    if (issue.message.includes("Dangerous function")) {
      fixes.add("eval や Function コンストラクタを避け、静的な DOM 操作だけに絞ってください。");
    }

    if (issue.message.includes("description is too short")) {
      fixes.add("Skill と extractor の説明文を、用途が分かる具体的な文章にしてください。");
    }

    if (issue.message.includes("outputSchema should be more specific")) {
      fixes.add("outputSchema を unknown のままにせず、返却 JSON の構造を具体的に書いてください。");
    }

    if (issue.message.includes("paths matcher is not set")) {
      fixes.add("対象ページが限定できるなら matchers.paths を追加して誤爆を減らしてください。");
    }

    if (issue.message.includes("does not contain an explicit return")) {
      fixes.add("extractor code には明示的な return を含めて、返り値を分かりやすくしてください。");
    }

    if (issue.message.includes("full function source")) {
      fixes.add(
        "extractor code は bare な文ではなく、`function () { ... }` か `async function () { ... }` の形で保存してください。",
      );
    }
  }

  return Array.from(fixes);
}

function slugifySkillId(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "skill-draft";
}

function parseCreateSkillDraftArgs(
  args: CreateSkillDraftArgs,
): { ok: true; value: CreateSkillDraftArgs } | { ok: false; error: string } {
  if (typeof args !== "object" || args === null) {
    return { ok: false, error: 'skill(action: "create_draft") arguments must be an object' };
  }

  if (typeof args.name !== "string") {
    return { ok: false, error: "name must be a string" };
  }

  if (typeof args.description !== "string") {
    return { ok: false, error: "description must be a string" };
  }

  if (args.scope !== undefined && args.scope !== "site" && args.scope !== "global") {
    return { ok: false, error: "scope must be either 'site' or 'global'" };
  }

  if (typeof args.matchers !== "object" || args.matchers === null) {
    return { ok: false, error: "matchers must be an object" };
  }

  if (
    args.matchers.hosts !== undefined &&
    (!Array.isArray(args.matchers.hosts) ||
      args.matchers.hosts.some((host) => typeof host !== "string"))
  ) {
    return { ok: false, error: "matchers.hosts must be a string array" };
  }

  if (
    args.matchers.paths !== undefined &&
    (!Array.isArray(args.matchers.paths) ||
      args.matchers.paths.some((path) => typeof path !== "string"))
  ) {
    return { ok: false, error: "matchers.paths must be a string array" };
  }

  if (
    args.matchers.signals !== undefined &&
    (!Array.isArray(args.matchers.signals) ||
      args.matchers.signals.some((signal) => typeof signal !== "string"))
  ) {
    return { ok: false, error: "matchers.signals must be a string array" };
  }

  if (!Array.isArray(args.extractors)) {
    return { ok: false, error: "extractors must be an array" };
  }

  if (args.instructionsMarkdown !== undefined && typeof args.instructionsMarkdown !== "string") {
    return { ok: false, error: "instructionsMarkdown must be a string when provided" };
  }

  for (const extractor of args.extractors) {
    if (typeof extractor !== "object" || extractor === null) {
      return { ok: false, error: "extractors must contain objects" };
    }

    if (
      typeof extractor.id !== "string" ||
      typeof extractor.name !== "string" ||
      typeof extractor.description !== "string" ||
      typeof extractor.code !== "string" ||
      typeof extractor.outputSchema !== "string"
    ) {
      return {
        ok: false,
        error: "each extractor must provide string id, name, description, code, and outputSchema",
      };
    }

    if (extractor.selector !== undefined && typeof extractor.selector !== "string") {
      return { ok: false, error: "extractor selector must be a string when provided" };
    }
  }

  return { ok: true, value: args };
}

function normalizeStringList(values: string[] | undefined): string[] {
  if (!values) return [];

  return values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => value);
}

function normalizeHosts(values: string[] | undefined): string[] {
  return normalizeStringList(values).map((value) => value.toLowerCase());
}

interface StoredSkillRecord {
  skill: Skill;
  markdown: string;
}

type SkillStorageMutation =
  | { type: "upsert"; skill: Skill; previousId?: string }
  | { type: "delete"; id: string };

function normalizeStoredSkillRecords(value: StoredSkillRecord[] | Skill[]): StoredSkillRecord[] {
  if (value.length === 0) return [];

  const first = value[0];
  if ("id" in first && !("skill" in first)) {
    return (value as Skill[]).map((skill) => ({ skill, markdown: "" }));
  }

  return value as StoredSkillRecord[];
}

function mergeStoredSkillRecords(
  primary: StoredSkillRecord[] | Skill[],
  legacy: StoredSkillRecord[] | Skill[],
): StoredSkillRecord[] {
  const records = new Map<string, StoredSkillRecord>();

  for (const record of normalizeStoredSkillRecords(legacy)) {
    records.set(record.skill.id, record);
  }

  for (const record of normalizeStoredSkillRecords(primary)) {
    records.set(record.skill.id, record);
  }

  return Array.from(records.values());
}

async function saveCustomSkillsToStorage(
  storage: StoragePort,
  mutation: SkillStorageMutation,
): Promise<string | null> {
  try {
    const current =
      (await storage.get<StoredSkillRecord[] | Skill[]>(CUSTOM_SKILLS_STORAGE_KEY)) ?? [];
    const legacy =
      (await storage.get<StoredSkillRecord[] | Skill[]>("tandemweb_custom_skills")) ?? [];
    const existing = mergeStoredSkillRecords(current, legacy);
    const records = new Map(existing.map((record) => [record.skill.id, record]));

    if (mutation.type === "upsert") {
      if (mutation.previousId && mutation.previousId !== mutation.skill.id) {
        records.delete(mutation.previousId);
      }
      records.set(mutation.skill.id, {
        skill: mutation.skill,
        markdown: renderSkillMarkdown(mutation.skill),
      });
    } else {
      records.delete(mutation.id);
    }

    await storage.set(CUSTOM_SKILLS_STORAGE_KEY, Array.from(records.values()));
    await storage.remove("tandemweb_custom_skills");
    return null;
  } catch (e: unknown) {
    return e instanceof Error ? e.message : String(e);
  }
}

type DraftStorageMutation =
  | { type: "append"; draft: StoredSkillDraft }
  | { type: "upsert"; draft: StoredSkillDraft }
  | { type: "replaceAll"; drafts: StoredSkillDraft[] };

async function saveSkillDraftToStorage(
  storage: StoragePort,
  mutation: DraftStorageMutation,
): Promise<string | null> {
  try {
    const drafts = (await storage.get<StoredSkillDraft[]>(SKILL_DRAFTS_STORAGE_KEY)) ?? [];

    if (mutation.type === "append") {
      await storage.set(SKILL_DRAFTS_STORAGE_KEY, [...drafts, mutation.draft]);
    } else if (mutation.type === "replaceAll") {
      await storage.set(SKILL_DRAFTS_STORAGE_KEY, mutation.drafts);
    } else {
      const index = drafts.findIndex((d) => d.draftId === mutation.draft.draftId);
      if (index === -1) {
        return `Draft not found: ${mutation.draft.draftId}`;
      }
      drafts[index] = mutation.draft;
      await storage.set(SKILL_DRAFTS_STORAGE_KEY, drafts);
    }

    return null;
  } catch (e: unknown) {
    return e instanceof Error ? e.message : String(e);
  }
}
