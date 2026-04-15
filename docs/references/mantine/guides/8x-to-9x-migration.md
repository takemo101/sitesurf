## [Migrate with LLM agents](#migrate-with-llm-agents)

You can use LLM agents to assist with the migration from 8.x to 9.x. The LLM documentation includes all breaking changes and migration steps in a format optimized for AI coding tools. Copy the link to the md documentation file and ask your AI agent to perform the migration for you.

[Migrate with LLM](https://mantine.dev/llms/guides-8x-to-9x.md)

## [Prerequisites](#prerequisites)

Mantine 9.x requires React 19.2 or later. If your project uses an older React version, you need to update it before migrating to Mantine 9.x. If you cannot update React to 19.2+ yet, you can continue using Mantine 8.x until you are ready to update React and migrate to Mantine 9.x.

## [Update dependencies](#update-dependencies)

- Update all `@mantine/*` packages to version 9.0.0
- If you use `@mantine/tiptap` package, update all `@tiptap/*` packages to the latest `3.x` version
- If you use `@mantine/charts` package, update `recharts` to the latest `3.x` version

## [use-form TransformValues type](#use-form-transformvalues-type)

The second generic type of the `useForm` hook is now the type of transformed values instead of the transform function type. New usage example:

## [Text color prop](#text-color-prop)

The `color` prop of the [Text](https://mantine.dev/core/text/) and [Anchor](https://mantine.dev/core/anchor/) components was removed. Use the `c` [style prop](https://mantine.dev/styles/style-props/) instead:

## [Light variant color changes](#light-variant-color-changes)

In Mantine 9, the `light` variant CSS variables were changed to use solid color values instead of transparency. If you need to keep 8.x behavior during migration, use `v8CssVariablesResolver`:

## [Form resolvers](#form-resolvers)

In 9.x, `@mantine/form` has built-in support for [Standard Schema](https://standardschema.dev/). If your schema library supports Standard Schema (Zod v4, Valibot, ArkType), use the built-in `schemaResolver` instead of a dedicated resolver package:

Example with 8.x:

Example with 9.x using Standard Schema (recommended):

## [TypographyStylesProvider](#typographystylesprovider)

- The [TypographyStylesProvider](https://mantine.dev/core/typography/) component was renamed to [Typography](https://mantine.dev/core/typography/):

## [Popover and Tooltip positionDependencies prop](#popover-and-tooltip-positiondependencies-prop)

The [Popover](https://mantine.dev/core/popover/) and [Tooltip](https://mantine.dev/core/tooltip/) components no longer accept the `positionDependencies` prop; it is no longer required – the position is now calculated automatically.

## [use-fullscreen hook changes](#use-fullscreen-hook-changes)

The [use-fullscreen](https://mantine.dev/hooks/use-fullscreen/) hook was split into two hooks: `useFullscreenElement` and `useFullscreenDocument`. This change was required to fix a stale ref issue in the previous implementation.

New usage with the `document` element:

New usage with a custom target element:

![For demo](https://raw.githubusercontent.com/mantinedev/mantine/master/.demo/images/bg-4.png)

## [use-mouse hook changes](#use-mouse-hook-changes)

The [use-mouse](https://mantine.dev/hooks/use-mouse/) hook was split into two hooks: `useMouse` and `useMousePosition`. This change was required to fix a stale ref issue in the previous implementation.

Previous usage with the `document` element:

New usage with `document`:

Mouse coordinates `{ x: 0, y: 0 }`

## [use-mutation-observer hook changes](#use-mutation-observer-hook-changes)

The [use-mutation-observer](https://mantine.dev/hooks/use-mutation-observer/) hook now uses the new callback ref approach. This change was required to fix stale ref issues and improve compatibility with dynamic node changes.

Previous usage (8.x):

New usage (9.x):

## [Rename hooks types](#rename-hooks-types)

`@mantine/hooks` types were renamed for consistency; rename them in your codebase:

- `UseScrollSpyReturnType` → `UseScrollSpyReturnValue`
- `StateHistory` → `UseStateHistoryValue`
- `OS` → `UseOSReturnValue`

## [Collapse in -> expanded](#collapse-in---expanded)

The [Collapse](https://mantine.dev/core/collapse/) component now uses the `expanded` prop instead of `in`:

## [Spoiler initialState -> defaultExpanded](#spoiler-initialstate---defaultexpanded)

The [Spoiler](https://mantine.dev/core/spoiler/) component's `initialState` prop was renamed to `defaultExpanded` for consistency with other Mantine components:

## [Grid gutter -> gap](#grid-gutter---gap)

The [Grid](https://mantine.dev/core/grid/) component `gutter` prop was renamed to `gap` for consistency with other layout components (like [Flex](https://mantine.dev/core/flex/) and [SimpleGrid](https://mantine.dev/core/simple-grid/)). Additionally, new `rowGap` and `columnGap` props were added to allow separate control of vertical and horizontal spacing:

## [Grid overflow="hidden" no longer required](#grid-overflowhidden-no-longer-required)

The [Grid](https://mantine.dev/core/grid/) component no longer uses negative margins for spacing between columns. It now uses native CSS `gap` property, so you can safely remove `overflow="hidden"` from your `Grid` components — it is no longer needed to prevent content overflow:

## [useLocalStorage and useSessionStorage return type](#uselocalstorage-and-usesessionstorage-return-type)

The `useLocalStorage` and `useSessionStorage` hooks now correctly include `undefined` in the return type when no `defaultValue` is provided. Previously, calling these hooks without `defaultValue` would type the value as `T` (e.g., `string`), even though at runtime the value could be `undefined`.

If you relied on the incorrect type, update your code to handle `undefined`:

The same change applies to `readLocalStorageValue`, `useSessionStorage`, and `readSessionStorageValue`.

## [Default border-radius change](#default-border-radius-change)

In 8.x, the default border-radius (`theme.defaultRadius`) was `sm` (`4px`). In 9.x, the default border-radius was changed to `md` (`8px`). To keep the previous behavior, set `defaultRadius` to `sm` in the theme:

## [Notifications pauseResetOnHover default change](#notifications-pauseresetonhover-default-change)

In 8.x, hovering over a notification paused the auto close timer only for that notification. In 9.x, the default behavior changed – hovering over any notification now pauses the auto close timer of all visible notifications. To keep the previous behavior, set `pauseResetOnHover="notification"`:
