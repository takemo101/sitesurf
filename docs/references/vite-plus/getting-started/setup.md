# Project Setup

## Creating a Project

`vp create` interactively scaffolds new Vite+ projects, monorepos, and apps inside existing workspaces.

## Overview

The `create` command is the fastest way to start with Vite+. It can be used in a few different ways:

- Start a new Vite+ monorepo
- Create a new standalone application or library
- Add a new app or library inside an existing project

This command can be used with built-in templates, community templates, or remote GitHub templates.

## Usage

bash

```
vp create
vp create <template>
vp create <template> -- <template-options>
```

## Built-in Templates

Vite+ ships with these built-in templates:

- `vite:monorepo` creates a new monorepo
- `vite:application` creates a new application
- `vite:library` creates a new library
- `vite:generator` creates a new generator

## Template Sources

`vp create` is not limited to the built-in templates.

- Use shorthand templates like `vite`, `@tanstack/start`, `svelte`, `next-app`, `nuxt`, `react-router`, and `vue`
- Use full package names like `create-vite` or `create-next-app`
- Use local templates such as `./tools/create-ui-component` or `@acme/generator-*`
- Use remote templates such as `github:user/repo` or `https://github.com/user/template-repo`

Run `vp create --list` to see the built-in templates and the common shorthand templates Vite+ recognizes.

## Options

- `--directory <dir>` writes the generated project into a specific target directory
- `--agent <name>` creates agent instructions files during scaffolding
- `--editor <name>` writes editor config files
- `--hooks` enables pre-commit hook setup
- `--no-hooks` skips hook setup
- `--no-interactive` runs without prompts
- `--verbose` shows detailed scaffolding output
- `--list` prints the available built-in and popular templates

## Template Options

Arguments after `--` are passed directly to the selected template.

This matters when the template itself accepts flags. For example, you can forward Vite template selection like this:

bash

```
vp create vite -- --template react-ts
```

## Examples

bash

```
# Interactive mode
vp create

# Create a Vite+ monorepo, application, library, or generator
vp create vite:monorepo
vp create vite:application
vp create vite:library
vp create vite:generator

# Use shorthand community templates
vp create vite
vp create @tanstack/start
vp create svelte

# Use full package names
vp create create-vite
vp create create-next-app

# Use remote templates
vp create github:user/repo
vp create https://github.com/user/template-repo
```

---

## Migrate to Vite+

`vp migrate` helps move existing projects onto Vite+.

## Overview

This command is the starting point for consolidating separate Vite, Vitest, Oxlint, Oxfmt, ESLint, and Prettier setups into Vite+.

Use it when you want to take an existing project and move it onto the Vite+ defaults instead of wiring each tool by hand.

## Usage

bash

```
vp migrate
vp migrate <path>
vp migrate --no-interactive
```

## Target Path

The positional `PATH` argument is optional.

- If omitted, `vp migrate` migrates the current directory
- If provided, it migrates that target directory instead

bash

```
vp migrate
vp migrate my-app
```

## Options

- `--agent <name>` writes agent instructions into the project
- `--no-agent` skips agent instruction setup
- `--editor <name>` writes editor config files into the project
- `--no-editor` skips editor config setup
- `--hooks` sets up pre-commit hooks
- `--no-hooks` skips hook setup
- `--no-interactive` runs the migration without prompts

## Migration Flow

The `migrate` command is designed to move existing projects onto Vite+ quickly. Here is what the command does:

- Updates project dependencies
- Rewrites imports where needed
- Merges tool-specific config into `vite.config.ts`
- Updates scripts to the Vite+ command surface
- Can set up commit hooks
- Can write agent and editor configuration files

Most projects will require further manual adjustments after running `vp migrate`.

## Recommended Workflow

Before running the migration:

- Upgrade to Vite 8+ and Vitest 4.1+ first
- Make sure you understand any existing lint, format, or test setup that should be preserved

After running the migration:

- Run `vp install`
- Run `vp check`
- Run `vp test`
- Run `vp build`

## Migration Prompt

If you want to hand this work to a coding agent (or the reader is a coding agent!), use this migration prompt:

md

```
Migrate this project to Vite+. Vite+ replaces the current split tooling around runtime management, package management, dev/build/test commands, linting, formatting, and packaging. Run `vp help` to understand Vite+ capabilities and `vp help migrate` before making changes. Use `vp migrate --no-interactive` in the workspace root. Make sure the project is using Vite 8+ and Vitest 4.1+ before migrating.

After the migration:

- Confirm `vite` imports were rewritten to `vite-plus` where needed
- Confirm `vitest` imports were rewritten to `vite-plus/test` where needed
- Remove old `vite` and `vitest` dependencies only after those rewrites are confirmed
- Move remaining tool-specific config into the appropriate blocks in `vite.config.ts`

Command mapping to keep in mind:

- `vp run <script>` is the equivalent of `pnpm run <script>`
- `vp test` runs the built-in test command, while `vp run test` runs the `test` script from `package.json`
- `vp install`, `vp add`, and `vp remove` delegate through the package manager declared by `packageManager`
- `vp dev`, `vp build`, `vp preview`, `vp lint`, `vp fmt`, `vp check`, and `vp pack` replace the corresponding standalone tools
- Prefer `vp check` for validation loops

Finally, verify the migration by running: `vp install`, `vp check`, `vp test`, and `vp build`

Summarize the migration at the end and report any manual follow-up still required.
```

## Tool-Specific Migrations

### Vitest

Vitest is automatically migrated through `vp migrate`. If you are migrating manually, you have to update all the imports to `vite-plus/test` instead:

ts

```
// before
import { describe, expect, it, vi } from 'vitest';

const { page } = await import('@vitest/browser/context');

// after
import { describe, expect, it, vi } from 'vite-plus/test';

const { page } = await import('vite-plus/test/browser/context');
```

### tsdown

If your project uses a `tsdown.config.ts`, move its options into the `pack` block in `vite.config.ts`:

ts

```
// before — tsdown.config.ts
import { defineConfig } from 'tsdown';

export default defineConfig({
 entry: ['src/index.ts'],
 dts: true,
 format: ['esm', 'cjs'],
});

// after — vite.config.ts
import { defineConfig } from 'vite-plus';

export default defineConfig({
 pack: {
 entry: ['src/index.ts'],
 dts: true,
 format: ['esm', 'cjs'],
 },
});
```

After merging, delete `tsdown.config.ts`. See the [Pack guide](https://viteplus.dev/guide/pack) for the full configuration reference.

### lint-staged

Vite+ replaces lint-staged with its own `staged` block in `vite.config.ts`. Only the `staged` config format is supported. Standalone `.lintstagedrc` in non-JSON format and `lint-staged.config.*` are not migrated automatically.

Move your lint-staged rules into the `staged` block:

ts

```
// vite.config.ts
import { defineConfig } from 'vite-plus';

export default defineConfig({
 staged: {
 '*.{js,ts,tsx,vue,svelte}': 'vp check --fix',
 },
});
```

After migrating, remove lint-staged from your dependencies and delete any lint-staged config files. See the [Commit hooks guide](https://viteplus.dev/guide/commit-hooks) and [Staged config reference](https://viteplus.dev/config/staged) for details.

## Examples

bash

```
# Migrate the current project
vp migrate

# Migrate a specific directory
vp migrate my-app

# Run without prompts
vp migrate --no-interactive

# Write agent and editor setup during migration
vp migrate --agent claude --editor zed
```

---

## Installing Dependencies

`vp install` installs dependencies using the current workspace's package manager.

## Overview

Use Vite+ to manage dependencies across pnpm, npm, and Yarn. Instead of switching between `pnpm install`, `npm install`, and `yarn install`, you can keep using `vp install`, `vp add`, `vp remove`, and the rest of the Vite+ package-management commands.

Vite+ detects the package manager from the workspace root in this order:

1. `packageManager` in `package.json`
2. `pnpm-workspace.yaml`
3. `pnpm-lock.yaml`
4. `yarn.lock` or `.yarnrc.yml`
5. `package-lock.json`
6. `.pnpmfile.cjs` or `pnpmfile.cjs`
7. `yarn.config.cjs`

If none of those files are present, `vp` falls back to `pnpm` by default. Vite+ automatically downloads the matching package manager and uses it for the command you ran.

## Usage

bash

```
vp install
```

Common install flows:

bash

```
vp install
vp install --frozen-lockfile
vp install --lockfile-only
vp install --filter web
vp install -w
```

`vp install` maps to the correct underlying install behavior for the detected package manager, including the right lockfile flags for pnpm, npm, and Yarn.

## Global Packages

Use the `-g` flag for installing, updating or removing globally installed packages:

- `vp install -g <pkg>` installs a package globally
- `vp uninstall -g <pkg>` removes a global package
- `vp update -g [pkg]` updates one global package or all of them
- `vp list -g [pkg]` lists global packages

## Managing Dependencies

Vite+ provides all the familiar package management commands:

- `vp install` installs the current dependency graph for the project
- `vp add <pkg>` adds packages to `dependencies`, use `-D` for `devDependencies`
- `vp remove <pkg>` removes packages
- `vp update` updates dependencies
- `vp dedupe` reduces duplicate dependency entries where the package manager supports it
- `vp outdated` shows available updates
- `vp list` shows installed packages
- `vp why <pkg>` explains why a package is present
- `vp info <pkg>` shows registry metadata for a package
- `vp link` and `vp unlink` manage local package links
- `vp dlx <pkg>` runs a package binary without adding it to the project
- `vp pm <command>` forwards a raw package-manager-specific command when you need behavior outside the normalized `vp` command set

### Command Guide

#### Install

Use `vp install` when you want to install exactly what the current `package.json` and lockfile describe.

- `vp install` is the standard install command
- `vp install --frozen-lockfile` fails if the lockfile would need changes
- `vp install --no-frozen-lockfile` allows lockfile updates explicitly
- `vp install --lockfile-only` updates the lockfile without performing a full install
- `vp install --prefer-offline` and `vp install --offline` prefer or require cached packages
- `vp install --ignore-scripts` skips lifecycle scripts
- `vp install --filter <pattern>` scopes install work in monorepos
- `vp install -w` installs in the workspace root

#### Global Install

Use these commands when you want package-manager-managed tools available outside a single project.

- `vp install -g typescript`
- `vp uninstall -g typescript`
- `vp update -g`
- `vp list -g`

#### Add and Remove

Use `vp add` and `vp remove` for day-to-day dependency edits instead of editing `package.json` by hand.

- `vp add react`
- `vp add -D typescript vitest`
- `vp add -O fsevents`
- `vp add --save-peer react`
- `vp remove react`
- `vp remove --filter web react`

#### Update, Dedupe, and Outdated

Use these commands to maintain the dependency graph over time.

- `vp update` refreshes packages to newer versions
- `vp outdated` shows which packages have newer versions available
- `vp dedupe` asks the package manager to collapse duplicates where possible

#### Inspect

Use these when you need to understand the current state of dependencies.

- `vp list` shows installed packages
- `vp why react` explains why `react` is installed
- `vp info react` shows registry metadata such as versions and dist-tags

#### Advanced

Use these when you need lower-level package-manager behavior.

- `vp link` and `vp unlink` manage local development links
- `vp dlx create-vite` runs a package binary without saving it as a dependency
- `vp pm <command>` forwards directly to the resolved package manager

Examples:

bash

```
vp pm config get registry
vp pm cache clean --force
vp pm exec tsc --version
```
