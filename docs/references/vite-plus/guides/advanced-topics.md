# Advanced Topics

## Upgrading Vite+

Use `vp upgrade` to update the global `vp` binary, and use Vite+'s package management commands to update the local `vite-plus` package in a project.

## Overview

There are two parts to upgrading Vite+:

- The global `vp` command installed on your machine
- The local `vite-plus` package used by an individual project

You can upgrade both of them independently.

## Global `vp`

bash

```
vp upgrade
```

## Local `vite-plus`

Update the project dependency with the package manager commands in Vite+:

bash

```
vp update vite-plus
```

You can also use `vp add vite-plus@latest` if you want to move the dependency explicitly to the latest version.

### Updating Aliased Packages

Vite+ sets up npm aliases for its core packages during installation:

- `vite` is aliased to `npm:@voidzero-dev/vite-plus-core@latest`
- `vitest` is aliased to `npm:@voidzero-dev/vite-plus-test@latest`

`vp update vite-plus` does not re-resolve these aliases in the lockfile. To fully upgrade, update them separately:

bash

```
vp update @voidzero-dev/vite-plus-core @voidzero-dev/vite-plus-test
```

Or update everything at once:

bash

```
vp update vite-plus @voidzero-dev/vite-plus-core @voidzero-dev/vite-plus-test
```

You can verify with `vp outdated` that no Vite+ packages remain outdated.

---

## Removing Vite+

Use `vp implode` to remove `vp` and all related Vite+ data from your machine.

## Overview

`vp implode` is the cleanup command for removing a Vite+ installation and its managed data. Use it if you no longer want Vite+ to manage your runtime, package manager, and related local tooling state.

INFO

If you decide Vite+ is not for you, please [share your feedback with us](https://discord.gg/cAnsqHh5PX).

## Usage

bash

```
vp implode
```

Skip the confirmation prompt with:

bash

```
vp implode --yes
```

---

## IDE Integration

Vite+ supports VS Code through the [Vite Plus Extension Pack](https://marketplace.visualstudio.com/items?itemName=VoidZero.vite-plus-extension-pack) and the VS Code settings that `vp create` and `vp migrate` can automatically write into your project.

## VS Code

For the best VS Code experience with Vite+, install the [Vite Plus Extension Pack](https://marketplace.visualstudio.com/items?itemName=VoidZero.vite-plus-extension-pack). It currently includes:

- `Oxc` for formatting and linting via `vp check`
- `Vitest` for test runs via `vp test`

When you create or migrate a project, Vite+ prompts whether you want editor config written for VS Code. You can also manually set up the VS Code config:

`.vscode/extensions.json`

json

```
{
 "recommendations": ["VoidZero.vite-plus-extension-pack"]
}
```

`.vscode/settings.json`

json

```
{
 "editor.defaultFormatter": "oxc.oxc-vscode",
 "oxc.fmt.configPath": "./vite.config.ts",
 "editor.formatOnSave": true,
 "editor.formatOnSaveMode": "file",
 "editor.codeActionsOnSave": {
 "source.fixAll.oxc": "explicit"
 }
}
```

This gives the project a shared default formatter and enables Oxc-powered fix actions on save. Setting `oxc.fmt.configPath` to `./vite.config.ts` keeps editor format-on-save aligned with the `fmt` block in your Vite+ config. Vite+ uses `formatOnSaveMode: "file"` because Oxfmt does not support partial formatting.

---

## Continuous Integration

You can use `voidzero-dev/setup-vp` to use Vite+ in CI environments.

## Overview

For GitHub Actions, the recommended setup is [`voidzero-dev/setup-vp`](https://github.com/voidzero-dev/setup-vp). It installs Vite+, sets up the required Node.js version and package manager, and can cache package installs automatically.

That means you usually do not need separate `setup-node`, package-manager setup, and manual dependency-cache steps in your workflow.

## GitHub Actions

yaml

```
- uses: voidzero-dev/setup-vp@v1
 with:
 node-version: '22'
 cache: true
- run: vp install
- run: vp check
- run: vp test
- run: vp build
```

With `cache: true`, `setup-vp` handles dependency caching for you automatically.

## Simplifying Existing Workflows

If you are migrating an existing GitHub Actions workflow, you can often replace large blocks of Node, package-manager, and cache setup with a single `setup-vp` step.

#### Before:

yaml

```
- uses: actions/setup-node@v4
 with:
 node-version: '24'

- uses: pnpm/action-setup@v4
 with:
 version: 10

- name: Get pnpm store path
 run: pnpm store path

- uses: actions/cache@v4
 with:
 path: ~/.pnpm-store
 key: ${{ runner.os }}-pnpm-${{ hashFiles('pnpm-lock.yaml') }}

- run: pnpm install && pnpm dev:setup
- run: pnpm test
```

#### After:

yaml

```
- uses: voidzero-dev/setup-vp@v1
 with:
 node-version: '24'
 cache: true

- run: vp install && vp run dev:setup
- run: vp check
- run: vp test
```

---

## Commit Hooks

Use `vp config` to install commit hooks, and `vp staged` to run checks on staged files.

## Overview

Vite+ supports commit hooks and staged-file checks without additional tooling.

Use:

- `vp config` to set up project hooks and related integrations
- `vp staged` to run checks against the files currently staged in Git

If you use [`vp create`](https://viteplus.dev/guide/create) or [`vp migrate`](https://viteplus.dev/guide/migrate), Vite+ prompts you to set this up for your project automatically.

## Commands

### `vp config`

`vp config` configures Vite+ for the current project. It installs Git hooks, sets up the hook directory, and can also handle related project integration such as agent setup. By default, hooks are written to `.vite-hooks`:

bash

```
vp config
vp config --hooks-dir.vite-hooks
```

### `vp staged`

`vp staged` runs staged-file checks using the `staged` config from `vite.config.ts`. If you set up Vite+ to handle your commit hooks, it will automatically run when you commit your local changes.

bash

```
vp staged
vp staged --verbose
vp staged --fail-on-changes
```

## Configuration

Define staged-file checks in the `staged` block in `vite.config.ts`:

ts

```
import { defineConfig } from 'vite-plus';

export default defineConfig({
 staged: {
 '*.{js,ts,tsx,vue,svelte}': 'vp check --fix',
 },
});
```

This is the default Vite+ approach and should replace separate `lint-staged` configuration in most projects. Because `vp staged` reads from `vite.config.ts`, your staged-file checks stay in the same place as your lint, format, test, build, and task-runner config.

---

## Troubleshooting

Use this page when something in Vite+ is not behaving the way you expect.

WARNING

Vite+ is still in alpha. We are making frequent changes, adding features quickly, and we want feedback to help make it great.

## Supported Tool Versions

Vite+ expects modern upstream tool versions.

- Vite 8 or newer
- Vitest 4.1 or newer

If you are migrating an existing project and it still depends on older Vite or Vitest versions, upgrade those first before adopting Vite+.

## `vp check` does not run type-aware lint rules or type checks

- Confirm that `lint.options.typeAware` and `lint.options.typeCheck` are enabled in `vite.config.ts`
- Check whether your `tsconfig.json` uses `compilerOptions.baseUrl`

The Oxlint type checker path powered by `tsgolint` does not support `baseUrl`, so Vite+ skips `typeAware` and `typeCheck` when that setting is present.

## `vp build` does not run my build script

Unlike package managers, built-in commands cannot be overwritten. If you are trying to run a `package.json` script use `vp run build` instead.

For example:

- `vp build` always runs the built-in Vite build
- `vp test` always runs the built-in Vitest command
- `vp run build` and `vp run test` run `package.json` scripts instead

INFO

You can also run custom tasks defined in `vite.config.ts` and migrate away from `package.json` scripts entirely.

## Staged Checks and Commit Hooks

If `vp staged` fails or your pre-commit hook does not run:

- make sure `vite.config.ts` contains a `staged` block
- run `vp config` to install hooks
- check whether hook installation was skipped intentionally through `VITE_GIT_HOOKS=0`

A minimal staged config looks like this:

ts

```
import { defineConfig } from 'vite-plus';

export default defineConfig({
 staged: {
 '*': 'vp check --fix',
 },
});
```

## Asking for Help

If you are stuck, please reach out:

- [Discord](https://discord.gg/cAnsqHh5PX) for real-time discussion and troubleshooting help
- [GitHub](https://github.com/voidzero-dev/vite-plus) for issues, discussions, and bug reports

When reporting a problem, please include:

- The full output of `vp env current` and `vp --version`
- The package manager used by the project
- The exact steps needed to reproduce the problem and your `vite.config.ts`
- A minimal reproduction repository or runnable sandbox
