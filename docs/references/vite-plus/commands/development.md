# Development Commands

## Dev

`vp dev` starts the Vite development server.

## Overview

`vp dev` runs the standard Vite development server through Vite+, so you keep the normal Vite dev experience while using the same CLI entry point as the rest of the toolchain. For more information about using and configuring the dev server, see the [Vite guide](https://vite.dev/guide/).

## Usage

bash

```
vp dev
```

## Configuration

Use standard Vite config in `vite.config.ts`. For the full configuration reference, see the [Vite config docs](https://vite.dev/config/).

Use it for:

- [plugins](https://vite.dev/guide/using-plugins)
- [aliases](https://vite.dev/config/shared-options#resolve-alias)
- [`server`](https://vite.dev/config/server-options)
- [environment modes](https://vite.dev/guide/env-and-mode)

---

## Check

`vp check` runs format, lint, and type checks together.

## Overview

`vp check` is the default command for fast static checks in Vite+. It brings together formatting through [Oxfmt](https://oxc.rs/docs/guide/usage/formatter.html), linting through [Oxlint](https://oxc.rs/docs/guide/usage/linter.html), and TypeScript type checks through [tsgolint](https://github.com/oxc-project/tsgolint). By merging all of these tasks into a single command, `vp check` is faster than running formatting, linting, and type checking as separate tools in separate commands.

When `typeCheck` is enabled in the `lint.options` block in `vite.config.ts`, `vp check` also runs TypeScript type checks through the Oxlint type-aware path powered by the TypeScript Go toolchain and [tsgolint](https://github.com/oxc-project/tsgolint). `vp create` and `vp migrate` enable both `typeAware` and `typeCheck` by default.

We recommend turning `typeCheck` on so `vp check` becomes the single command for static checks during development.

## Usage

bash

```
vp check
vp check --fix # Format and run autofixers.
```

## Configuration

`vp check` uses the same configuration you already define for linting and formatting:

- [`lint`](https://viteplus.dev/guide/lint#configuration) block in `vite.config.ts`
- [`fmt`](https://viteplus.dev/guide/fmt#configuration) block in `vite.config.ts`
- TypeScript project structure and tsconfig files for type-aware linting

Recommended base `lint` config:

ts

```
import { defineConfig } from 'vite-plus';

export default defineConfig({
 lint: {
 options: {
 typeAware: true,
 typeCheck: true,
 },
 },
});
```

---

## Lint

`vp lint` lints code with Oxlint.

## Overview

`vp lint` is built on [Oxlint](https://oxc.rs/docs/guide/usage/linter.html), the Oxc linter. Oxlint is designed as a fast replacement for ESLint for most frontend projects and ships with built-in support for core ESLint rules and many popular community rules.

Use `vp lint` to lint your project, and `vp check` to format, lint and type-check all at once.

## Usage

bash

```
vp lint
vp lint --fix
vp lint --type-aware
```

## Configuration

Put lint configuration directly in the `lint` block in `vite.config.ts` so all your configuration stays in one place. We do not recommend using `oxlint.config.ts` or `.oxlintrc.json` with Vite+.

For the upstream rule set, options, and compatibility details, see the [Oxlint docs](https://oxc.rs/docs/guide/usage/linter.html).

ts

```
import { defineConfig } from 'vite-plus';

export default defineConfig({
 lint: {
 ignorePatterns: ['dist/**'],
 options: {
 typeAware: true,
 typeCheck: true,
 },
 },
});
```

## Type-Aware Linting

We recommend enabling both `typeAware` and `typeCheck` in the `lint` block:

- `typeAware: true` enables rules that require TypeScript type information
- `typeCheck: true` enables full type checking during linting

This path is powered by [tsgolint](https://github.com/oxc-project/tsgolint) on top of the TypeScript Go toolchain. It gives Oxlint access to type information and allows type checking directly via `vp lint` and `vp check`.

## JS Plugins

If you are migrating from ESLint and still depend on a few critical JavaScript-based ESLint plugins, Oxlint has [JS plugin support](https://oxc.rs/docs/guide/usage/linter/js-plugins) that can help you keep those plugins running while you complete the migration.

---

## Format

`vp fmt` formats code with Oxfmt.

## Overview

`vp fmt` is built on [Oxfmt](https://oxc.rs/docs/guide/usage/formatter.html), the Oxc formatter. Oxfmt has full Prettier compatibility and is designed as a fast drop-in replacement for Prettier.

Use `vp fmt` to format your project, and `vp check` to format, lint and type-check all at once.

## Usage

bash

```
vp fmt
vp fmt --check
vp fmt. --write
```

## Configuration

Put formatting configuration directly in the `fmt` block in `vite.config.ts` so all your configuration stays in one place. We do not recommend using `.oxfmtrc.json` with Vite+.

For editors, point the formatter config path at `./vite.config.ts` so format-on-save uses the same `fmt` block:

json

```
{
 "oxc.fmt.configPath": "./vite.config.ts"
}
```

For the upstream formatter behavior and configuration reference, see the [Oxfmt docs](https://oxc.rs/docs/guide/usage/formatter.html).

ts

```
import { defineConfig } from 'vite-plus';

export default defineConfig({
 fmt: {
 singleQuote: true,
 },
});
```

---

## Test

`vp test` runs tests with [Vitest](https://vitest.dev/).

## Overview

`vp test` is built on [Vitest](https://vitest.dev/), so you get a Vite-native test runner that reuses your Vite config and plugins, supports Jest-style expectations, snapshots, and coverage, and handles modern ESM, TypeScript, and JSX projects cleanly.

## Usage

bash

```
vp test
vp test watch
vp test run --coverage
```

INFO

Unlike Vitest on its own, `vp test` does not stay in watch mode by default. Use `vp test` when you want a normal test run, and use `vp test watch` when you want to jump into watch mode.

## Configuration

Put test configuration directly in the `test` block in `vite.config.ts` so all your configuration stays in one place. We do not recommend using `vitest.config.ts` with Vite+.

ts

```
import { defineConfig } from 'vite-plus';

export default defineConfig({
 test: {
 include: ['src/**/*.test.ts'],
 },
});
```

For the full Vitest configuration reference, see the [Vitest config docs](https://vitest.dev/config/).
