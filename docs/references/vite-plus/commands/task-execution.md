# Task Execution

## Run

`vp run` runs `package.json` scripts and tasks defined in `vite.config.ts`. It works like `pnpm run`, with caching, dependency ordering, and workspace-aware execution built in.

TIP

`vpr` is available as a standalone shorthand for `vp run`. All examples below work with both `vp run` and `vpr`.

## Overview

Use `vp run` with existing `package.json` scripts:

json

```
{
 "scripts": {
 "build": "node compile-legacy-app.js",
 "test": "jest"
 }
}
```

`vp run build` executes the associated build script:

```
$ node compile-legacy-app.js

building legacy app for production...

✓ built in 69s
```

Use `vp run` without a task name to use the interactive task runner:

```
Select a task (↑/↓, Enter to run, Esc to clear):

 › build: node compile-legacy-app.js
 test: jest
```

## Caching

`package.json` scripts are not cached by default. Use `--cache` to enable caching:

bash

```
vp run --cache build
```

```
$ node compile-legacy-app.js
✓ built in 69s
```

If nothing changes, the output is replayed from the cache on the next run:

```
$ node compile-legacy-app.js ✓ cache hit, replaying
✓ built in 69s

---
vp run: cache hit, 69s saved.
```

If an input changes, the task runs again:

```
$ node compile-legacy-app.js ✗ cache miss: 'legacy/index.js' modified, executing
```

## Task Definitions

Vite Task automatically tracks which files your command uses. You can define tasks directly in `vite.config.ts` to enable caching by default or control which files and environment variables affect cache behavior.

ts

```
import { defineConfig } from 'vite-plus';

export default defineConfig({
 run: {
 tasks: {
 build: {
 command: 'vp build',
 dependsOn: ['lint'],
 env: ['NODE_ENV'],
 },
 deploy: {
 command: 'deploy-script --prod',
 cache: false,
 dependsOn: ['build', 'test'],
 },
 },
 },
});
```

If you want to run an existing `package.json` script as-is, use `vp run <script>`. If you want task-level caching, dependencies, or environment/input controls, define a task with an explicit `command`. A task name can come from `vite.config.ts` or `package.json`, but not both.

INFO

Tasks defined in `vite.config.ts` are cached by default. `package.json` scripts are not. See [When Is Caching Enabled?](https://viteplus.dev/guide/cache#when-is-caching-enabled) for the full resolution order.

See [Run Config](https://viteplus.dev/config/run) for the full `run` block reference.

## Task Dependencies

Use [`dependsOn`](#depends-on) to run tasks in the right order. Running `vp run deploy` with the config above runs `build` and `test` first. Dependencies can also target other packages in the same project with the `package#task` notation:

ts

```
dependsOn: ['@my/core#build', '@my/utils#lint'];
```

## Running in a Workspace

With no package-selection flags, `vp run` runs the task in the package in your current working directory:

bash

```
cd packages/app
vp run build
```

You can also target a package explicitly from anywhere:

bash

```
vp run @my/app#build
```

Workspace package ordering is based on the normal monorepo dependency graph declared in each package's `package.json`. In other words, when Vite+ talks about package dependencies, it means the regular `dependencies` relationships between workspace packages, not a separate task-runner-specific graph.

### Recursive (`-r`)

Run the task in every workspace package, in dependency order:

bash

```
vp run -r build
```

That dependency order comes from the workspace packages referenced through `package.json` dependencies.

### Transitive (`-t`)

Run the task in one package and all of its dependencies:

bash

```
vp run -t @my/app#build
```

If `@my/app` depends on `@my/utils`, which depends on `@my/core`, this runs all three in order. Vite+ resolves that chain from the normal workspace package dependencies declared in `package.json`.

### Filter (`--filter`)

Select packages by name, directory, or glob pattern. The syntax matches pnpm's `--filter`:

bash

```
# By name
vp run --filter @my/app build

# By glob
vp run --filter "@my/*" build

# By directory
vp run --filter./packages/app build

# Include dependencies
vp run --filter "@my/app..." build

# Include dependents
vp run --filter "...@my/core" build

# Exclude packages
vp run --filter "@my/*" --filter "!@my/utils" build
```

Multiple `--filter` flags are combined as a union. Exclusion filters are applied after all inclusions.

### Workspace Root (`-w`)

Explicitly run the task in the workspace root package:

bash

```
vp run -w build
```

## Compound Commands

Commands joined with `&&` are split into independent sub-tasks. Each sub-task is cached separately when [caching is enabled](https://viteplus.dev/guide/cache#when-is-caching-enabled). This works for both `vite.config.ts` tasks and `package.json` scripts:

json

```
{
 "scripts": {
 "check": "vp lint && vp build"
 }
}
```

Now, run `vp run --cache check`:

```
$ vp lint
Found 0 warnings and 0 errors.

$ vp build
✓ built in 28ms

---
vp run: 0/2 cache hit (0%).
```

Each sub-task has its own cache entry. If only `.ts` files changed but lint still passes, only `vp build` runs again the next time `vp run --cache check` is called:

```
$ vp lint ✓ cache hit, replaying
$ vp build ✗ cache miss: 'src/index.ts' modified, executing
✓ built in 30ms

---
vp run: 1/2 cache hit (50%), 120ms saved.
```

### Nested `vp run`

When a command contains `vp run`, Vite Task inlines it as separate tasks instead of spawning a nested process. Each sub-task is cached independently and output stays flat:

json

```
{
 "scripts": {
 "ci": "vp run lint && vp run test && vp run build"
 }
}
```

Running `vp run ci` expands into three tasks:

lint

test

build

Flags also work inside nested scripts. For example, `vp run -r build` inside a script expands into individual build tasks for every package.

INFO

A common monorepo pattern is a root script that runs a task recursively:

json

```
{
 "scripts": {
 "build": "vp run -r build"
 }
}
```

This creates a potential recursion: root's `build` -> `vp run -r build` -> includes root's `build` ->...

Vite Task detects this and prunes the self-reference automatically, so other packages build normally.

## Execution Summary

Use `-v` to show a detailed execution summary:

bash

```
vp run -r -v build
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Vite+ Task Runner • Execution Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Statistics: 3 tasks • 3 cache hits • 0 cache misses
Performance: 100% cache hit rate, 468ms saved in total

Task Details:
────────────────────────────────────────────────
 [1] @my/core#build: ~/packages/core$ vp build ✓
 → Cache hit - output replayed - 200ms saved
 ·······················································
 [2] @my/utils#build: ~/packages/utils$ vp build ✓
 → Cache hit - output replayed - 150ms saved
 ·······················································
 [3] @my/app#build: ~/packages/app$ vp build ✓
 → Cache hit - output replayed - 118ms saved
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Use `--last-details` to show the summary from the last run without running tasks again:

bash

```
vp run --last-details
```

## Concurrency

By default, up to 4 tasks run at the same time. Use `--concurrency-limit` to change this:

bash

```
# Run up to 8 tasks at once
vp run -r --concurrency-limit 8 build

# Run tasks one at a time
vp run -r --concurrency-limit 1 build
```

The limit can also be set via the `VP_RUN_CONCURRENCY_LIMIT` environment variable. The `--concurrency-limit` flag takes priority over the environment variable.

### Parallel Mode

Use `--parallel` to ignore task dependencies and run all tasks at once with unlimited concurrency:

bash

```
vp run -r --parallel dev
```

This is useful when tasks are independent and you want maximum throughput. You can combine `--parallel` with `--concurrency-limit` to run tasks without dependency ordering but still cap the number of concurrent tasks:

bash

```
vp run -r --parallel --concurrency-limit 4 dev
```

## Additional Arguments

Arguments after the task name are passed through to the task command:

bash

```
vp run test --reporter verbose
```

---

## Task Caching

Vite Task can automatically track dependencies and cache tasks run through `vp run`.

## Overview

When a task runs successfully (exit code 0), its terminal output (stdout/stderr) is saved. On the next run, Vite Task checks if anything changed:

1. **Arguments:** did the [additional arguments](https://viteplus.dev/guide/run#additional-arguments) passed to the task change?
2. **Environment variables:** did any [fingerprinted env vars](https://viteplus.dev/config/run#env) change?
3. **Input files:** did any file that the command reads change?

If everything matches, the cached output is replayed instantly, and the command does not run.

INFO

Currently, only terminal output is cached and replayed. Output files such as `dist/` are not cached. If you delete them, use `--no-cache` to force a re-run. Output file caching is planned for a future release.

When a cache miss occurs, Vite Task tells you exactly why:

```
$ vp lint ✗ cache miss: 'src/utils.ts' modified, executing
$ vp build ✗ cache miss: env changed, executing
$ vp test ✗ cache miss: args changed, executing
```

## When Is Caching Enabled?

A command run by `vp run` is either a **task** defined in `vite.config.ts` or a **script** defined in `package.json`. Task names and script names cannot overlap. By default, **tasks are cached and scripts are not.**

There are three types of controls for task caching, in order:

### 1\. Per-task `cache: false`

A task can set [`cache: false`](https://viteplus.dev/config/run#cache) to opt out. This cannot be overridden by any other cache control flag.

### 2\. CLI flags

`--no-cache` disables caching for everything. `--cache` enables caching for both tasks and scripts, which is equivalent to setting [`run.cache: true`](https://viteplus.dev/config/run#run-cache) for that invocation.

### 3\. Workspace config

The [`run.cache`](https://viteplus.dev/config/run#run-cache) option in your root `vite.config.ts` controls the default for each category:

| Setting         | Default | Effect                                  |
| --------------- | ------- | --------------------------------------- |
| `cache.tasks`   | `true`  | Cache tasks defined in `vite.config.ts` |
| `cache.scripts` | `false` | Cache `package.json` scripts            |

## Automatic File Tracking

Vite Task tracks which files each command reads during execution. When a task runs, it records which files the process opens, such as your `.ts` source files, `vite.config.ts`, and `package.json`, and records their content hashes. On the next run, it re-checks those hashes to determine if anything changed.

This means caching works out of the box for most commands without any configuration. Vite Task also records:

- **Missing files:** if a command probes for a file that doesn't exist, such as `utils.ts` during module resolution, creating that file later correctly invalidates the cache.
- **Directory listings:** if a command scans a directory, such as a test runner looking for `*.test.ts`, adding or removing files in that directory invalidates the cache.

### Avoiding Overly Broad Input Tracking

Automatic tracking can sometimes include more files than necessary, causing unnecessary cache misses:

- **Tool cache files:** some tools maintain their own cache, such as TypeScript's `.tsbuildinfo` or Cargo's `target/`. These files may change between runs even when your source code has not, causing unnecessary cache invalidation.
- **Directory listings:** when a command scans a directory, such as when globbing for `**/*.js`, Vite Task sees the directory read but not the glob pattern. Any file added or removed in that directory, even unrelated ones, invalidates the cache.

Use the [`input`](https://viteplus.dev/config/run#input) option to exclude files or to replace automatic tracking with explicit file patterns:

ts

```
tasks: {
 build: {
 command: 'tsc',
 input: [{ auto: true }, '!**/*.tsbuildinfo'],
 },
}
```

## Environment Variables

By default, tasks run in a clean environment. Only a small set of common variables, such as `PATH`, `HOME`, and `CI`, are passed through. Other environment variables are neither visible to the task nor included in the cache fingerprint.

To add an environment variable to the cache key, add it to [`env`](https://viteplus.dev/config/run#env). Changing its value then invalidates the cache:

ts

```
tasks: {
 build: {
 command: 'webpack --mode production',
 env: ['NODE_ENV'],
 },
}
```

To pass a variable to the task **without** affecting cache behavior, use [`untrackedEnv`](https://viteplus.dev/config/run#untracked-env). This is useful for variables like `CI` or `GITHUB_ACTIONS` that should be available in the task, but do not generally affect caching behavior.

See [Run Config](https://viteplus.dev/config/run#env) for details on wildcard patterns and the full list of automatically passed-through variables.

## Cache Sharing

Vite Task's cache is content-based. If two tasks run the same command with the same inputs, they share the cache entry. This happens naturally when multiple tasks include a common step, either as standalone tasks or as parts of [compound commands](https://viteplus.dev/guide/run#compound-commands):

json

```
{
 "scripts": {
 "check": "vp lint && vp build",
 "release": "vp lint && deploy-script"
 }
}
```

With caching enabled, for example through `--cache` or [`run.cache.scripts: true`](https://viteplus.dev/config/run#run-cache), running `check` first means the `vp lint` step in `release` is an instant cache hit, since both run the same command against the same files.

## Cache Commands

Use `vp cache clean` when you need to clear cached task results:

bash

```
vp cache clean
```

The task cache is stored in `node_modules/.vite/task-cache` at the project root. `vp cache clean` deletes that cache directory.

---

## Running Binaries

Use `vpx`, `vp exec`, and `vp dlx` to run binaries without switching between local installs, downloaded packages, and project-specific tools.

## Overview

`vpx` executes a command from a local or remote npm package. It can run a package that is already available locally, download a package on demand, or target an explicit package version.

Use the other binary commands when you need stricter control:

- `vpx` resolves a package binary locally first and can download it when needed
- `vp exec` runs a binary from the current project's `node_modules/.bin`
- `vp dlx` runs a package binary without adding it as a dependency

## `vpx`

Use `vpx` for running any local or remote binary:

bash

```
vpx <pkg[@version]> [args...]
```

### Options

- `-p, --package <name>` installs one or more packages before running the command
- `-c, --shell-mode` executes the command inside a shell
- `-s, --silent` suppresses Vite+ output and only shows the command output

### Examples

bash

```
vpx eslint.
vpx create-vue my-app
vpx typescript@5.5.4 tsc --version
vpx -p cowsay -c 'echo "hi" | cowsay'
```

## `vp exec`

Use `vp exec` when the binary must come from the current project, for example a binary from a dependency installed in `node_modules/.bin`.

bash

```
vp exec <command> [args...]
```

Examples:

bash

```
vp exec eslint.
vp exec tsc --noEmit
```

## `vp dlx`

Use `vp dlx` for one-off package execution without adding the package to your project dependencies.

bash

```
vp dlx <package> [args...]
```

Examples:

bash

```
vp dlx create-vite
vp dlx typescript tsc --version
```
