## [Support Mantine development](#support-mantine-development)

You can now sponsor Mantine development with [OpenCollective](https://opencollective.com/mantinedev). All funds are used to improve Mantine and create new features and components.

[Sponsor Mantine](https://opencollective.com/mantinedev)

## [Migration guide](#migration-guide)

This changelog covers breaking changes and new features in Mantine 9.0. To migrate your application to Mantine 9.0, follow [8.x → 9.x migration guide](https://mantine.dev/guides/8x-to-9x/).

## [Peer dependencies requirements updates](#peer-dependencies-requirements-updates)

Starting from Mantine 9.0, the following dependencies are required:

- React 19.2+ for all `@mantine/*` packages
- Tiptap 3+ for `@mantine/tiptap` ([migration guide](https://mantine.dev/guides/tiptap-3-migration/))
- Recharts 3+ for `@mantine/charts` (no migration required)

## [New @mantine/schedule package](#new-mantineschedule-package)

New [`@mantine/schedule`](https://mantine.dev/schedule/getting-started/) package provides a complete set of calendar scheduling components for React applications. It includes multiple view levels, drag-and-drop event management, and extensive customization options.

### [Schedule](#schedule)

[Schedule](https://mantine.dev/schedule/schedule/) is a unified container component that combines all views with built-in navigation and view switching. Drag events to reschedule them:

### [DayView](#dayview)

[DayView](https://mantine.dev/schedule/day-view/) displays a single day with configurable time slots, all-day event section, current time indicator, and business hours highlighting. Drag events to reschedule them:

### [WeekView](#weekview)

[WeekView](https://mantine.dev/schedule/week-view/) shows a weekly calendar grid with time slots, week numbers, weekend day toggling, and multi-day event spanning. Drag events across days and time slots:

### [MonthView](#monthview)

[MonthView](https://mantine.dev/schedule/month-view/) displays a monthly calendar grid with event overflow handling, outside days display, and week numbers. Drag events to different days:

### [YearView](#yearview)

[YearView](https://mantine.dev/schedule/year-view/) provides a 12-month year overview organized by quarters with day-level event indicators:

M

T

W

T

F

S

S

M

T

W

T

F

S

S

M

T

W

T

F

S

S

M

T

W

T

F

S

S

M

T

W

T

F

S

S

M

T

W

T

F

S

S

M

T

W

T

F

S

S

M

T

W

T

F

S

S

M

T

W

T

F

S

S

M

T

W

T

F

S

S

M

T

W

T

F

S

S

M

T

W

T

F

S

S

### [MobileMonthView](#mobilemonthview)

[MobileMonthView](https://mantine.dev/schedule/mobile-month-view/) is a mobile-optimized month view with event details panel for the selected day:

Mo

Tu

We

Th

Fr

Sa

Su

No events

To get started, follow the [getting started guide](https://mantine.dev/schedule/getting-started/).

## [Collapse horizontal orientation](#collapse-horizontal-orientation)

[Collapse](https://mantine.dev/core/collapse/) component now supports horizontal orientation:

## [use-collapse and use-horizontal-collapse hooks](#use-collapse-and-use-horizontal-collapse-hooks)

New `use-collapse` hook is the hook version of [Collapse](https://mantine.dev/core/collapse/) component. It allows animation of height from `0` to `auto` and vice versa.

`use-horizontal-collapse` works the same way as `use-collapse` but animates width instead of height:

## [use-floating-window hook](#use-floating-window-hook)

New [use-floating-window](https://mantine.dev/hooks/use-floating-window/) hook allows creating floating draggable elements:

## [FloatingWindow component](#floatingwindow-component)

[FloatingWindow](https://mantine.dev/core/floating-window/) provides component API for [use-floating-window](https://mantine.dev/hooks/use-floating-window/) hook:

## [OverflowList component](#overflowlist-component)

New [OverflowList](https://mantine.dev/core/overflow-list/) component displays list of items and collapses the overflowing items into a single element:

Apple

Banana

Cherry

Date

Elderberry

Fig

Grape

+9 more

## [Marquee component](#marquee-component)

New [Marquee](https://mantine.dev/core/marquee/) component creates continuous scrolling animation for content:

## [Scroller component](#scroller-component)

New [Scroller](https://mantine.dev/core/scroller/) component displays horizontally scrollable content with navigation controls. It supports native scrolling via trackpad, shift + mouse wheel, touch gestures, and mouse drag:

## [use-scroller hook](#use-scroller-hook)

New [use-scroller](https://mantine.dev/hooks/use-scroller/) hook provides logic for creating custom scrollable containers with navigation controls:

1

2

3

4

5

6

7

8

9

10

11

12

13

14

15

16

17

18

19

20

## [BarsList component](#barslist-component)

New [BarsList](https://mantine.dev/charts/bars-list/) component displays a list of horizontal bars with names and values. It supports custom colors, auto contrast, value formatting, and custom bar rendering:

React

950000

Vue

320000

Angular

580000

Svelte

145000

Next.js

720000

Nuxt

180000

Remix

95000

## [Card horizontal orientation](#card-horizontal-orientation)

[Card](https://mantine.dev/core/card/) component now supports horizontal orientation:

81%

Completed

Project tasks

1887

Completed

447

Remaining

76

In progress

## [Checkbox.Group and Switch.Group maxSelectedValues](#checkboxgroup-and-switchgroup-maxselectedvalues)

[Checkbox.Group](https://mantine.dev/core/checkbox/) and [Switch.Group](https://mantine.dev/core/switch/) now support `maxSelectedValues` prop to limit the number of selected values. When the limit is reached, the remaining controls are disabled and cannot be selected.

React

Svelte

Angular

Vue

## [Inputs loading state](#inputs-loading-state)

All Mantine input components based on [Input](https://mantine.dev/core/input/) component now support `loading` prop.

Set `loading` prop to display a loading indicator. By default, the loader is displayed on the right side of the input. You can change the position with the `loadingPosition` prop to `'left'` or `'right'`. This is useful for async operations like API calls, searches, or validations:

## [renderPill in MultiSelect and TagsInput](#renderpill-in-multiselect-and-tagsinput)

[MultiSelect](https://mantine.dev/core/multi-select/) and [TagsInput](https://mantine.dev/core/tags-input/) components now support `renderPill` prop to customize pill rendering:

Candidates

![](https://raw.githubusercontent.com/mantinedev/mantine/master/.demo/avatars/avatar-7.png)

Emily Johnson

![](https://raw.githubusercontent.com/mantinedev/mantine/master/.demo/avatars/avatar-8.png)

Ava Rodriguez

## [Clear section mode](#clear-section-mode)

All clearable input components now support `clearSectionMode` prop that determines how the clear button and `rightSection` are rendered:

- `'both'` (default) – render both the clear button and `rightSection`
- `'rightSection'` – render only the user-supplied `rightSection`, ignore clear button
- `'clear'` – render only the clear button, ignore `rightSection`

This prop is supported by [Select](https://mantine.dev/core/select/), [Autocomplete](https://mantine.dev/core/autocomplete/), [MultiSelect](https://mantine.dev/core/multi-select/), [TagsInput](https://mantine.dev/core/tags-input/), [FileInput](https://mantine.dev/core/file-input/), [DateInput](https://mantine.dev/dates/date-input/), [DatePickerInput](https://mantine.dev/dates/date-picker-input/), [MonthPickerInput](https://mantine.dev/dates/month-picker-input/), [YearPickerInput](https://mantine.dev/dates/year-picker-input/), [TimePicker](https://mantine.dev/dates/time-picker/), and [DateTimePicker](https://mantine.dev/dates/date-time-picker/).

clearSectionMode='both' (default)

clearSectionMode='rightSection'

clearSectionMode='clear'

## [use-form async validation](#use-form-async-validation)

[use-form](https://mantine.dev/form/use-form/) validation rules can now be async – return a `Promise` that resolves to an error message or `null`. When all rules are synchronous, `form.validate()`, `form.validateField()` and `form.isValid()` return their results directly (not wrapped in a `Promise`). When any rule is async, these methods return promises instead. TypeScript infers the correct return type based on your validation rules, so you get precise types without manual annotations.

The `form.validating` property is `true` while any async validation is in progress, and `form.isValidating(path)` checks individual fields. The `validating` state is never set for forms with only synchronous rules.

Each rule receives an `AbortSignal` as the fourth argument. The signal is aborted when a newer validation supersedes the current one, which you can use to cancel in-flight HTTP requests.

When using async validation with `validateInputOnChange`, set `validateDebounce` to avoid firing an API call on every keystroke:

Username

Try: admin, user, test, mantine

Email

## [use-form TransformedValues type argument](#use-form-transformedvalues-type-argument)

[use-form](https://mantine.dev/form/use-form/) now supports passing second type argument `TransformedValues` to define the type of transformed values returned by `form.getTransformedValues` and `form.onSubmit`:

## [Generic components](#generic-components)

[SegmentedControl](https://mantine.dev/core/segmented-control/), [Select](https://mantine.dev/core/select/), [MultiSelect](https://mantine.dev/core/multi-select/), [Chip.Group](https://mantine.dev/core/chip/), [Switch.Group](https://mantine.dev/core/switch/), [Checkbox.Group](https://mantine.dev/core/checkbox/) and [Radio.Group](https://mantine.dev/core/radio/) now support generic value type. You can pass primitive values (numbers, strings, booleans, bigint) as the type argument. The generic type is used for `value`, `defaultValue`, `onChange` and other props.

For example, generic type can now be used with [SegmentedControl](https://mantine.dev/core/segmented-control/) to specify string union:

## [Combobox virtualization](#combobox-virtualization)

[Combobox](https://mantine.dev/core/combobox/) component now supports [virtualization](https://mantine.dev/core/combobox/#virtualization) with the `useVirtualizedCombobox` hook. The hook does not depend on any specific virtualization library. The recommended option is [@tanstack/react-virtual](https://tanstack.com/virtual/latest).

Example of implementation with `useVirtualizedCombobox` and [@tanstack/react-virtual](https://tanstack.com/virtual/latest):

You can find more virtualization examples on the [Combobox examples page](https://mantine.dev/combobox/?e=VirtualizedTanstack).

## [Highlight per-term colors](#highlight-per-term-colors)

[Highlight](https://mantine.dev/core/highlight/) component now supports custom colors for individual highlight terms. You can provide an array of objects with `text` and `color` properties to assign different colors to different highlighted terms:

Error: Invalid input. Warning: Check this field. Success: All tests passed.

## [Highlight whole-word matching](#highlight-whole-word-matching)

[Highlight](https://mantine.dev/core/highlight/) component now supports `wholeWord` prop to match only complete words. When enabled, 'the' will not match 'there' or 'theme':

With whole word matching (wholeWord={true})

The theme is there

Without whole word matching (default)

The theme is there

## [Pagination and use-pagination startValue](#pagination-and-use-pagination-startvalue)

[Pagination](https://mantine.dev/core/pagination/) component and [use-pagination](https://mantine.dev/hooks/use-pagination/) hook now support `startValue` prop to define the starting page number. For example, with `startValue={5}` and `total={15}`, the pagination range will be from 5 to 15:

Pages 5–15 (startValue=5, total=15)

## [Grid improvements](#grid-improvements)

[Grid](https://mantine.dev/core/grid/) component no longer uses negative margins for spacing between columns. Instead, it now uses native CSS `gap` property, which means you no longer need to use `overflow="hidden"` to prevent content overflow caused by negative margins.

## [Slider vertical orientation](#slider-vertical-orientation)

[Slider](https://mantine.dev/core/slider/) and [RangeSlider](https://mantine.dev/core/slider/) components now support vertical orientation:

20%

50%

80%

20%

50%

80%

## [SimpleGrid improvements](#simplegrid-improvements)

[SimpleGrid](https://mantine.dev/core/simple-grid/) component now supports `minColWidth` prop to use CSS Grid `auto-fill`/`auto-fit` to automatically adjust the number of columns based on available space and minimum column width. When `minColWidth` is set, the `cols` prop is ignored. Use `autoFlow` prop to switch between `auto-fill` (default) and `auto-fit` behavior.

1

2

3

4

5

[SimpleGrid](https://mantine.dev/core/simple-grid/) also now supports `autoRows` prop to control the size of implicitly created grid rows:

1

2

3

4

5

## [Calendar fullWidth prop](#calendar-fullwidth-prop)

[Calendar](https://mantine.dev/dates/calendar/), [DatePicker](https://mantine.dev/dates/date-picker/), [MonthPicker](https://mantine.dev/dates/month-picker/) and [YearPicker](https://mantine.dev/dates/year-picker/) components now support `fullWidth` prop to make the calendar stretch to fill 100% of its parent container width:

| Mo  | Tu  | We  | Th  | Fr  | Sa  | Su  |
| --- | --- | --- | --- | --- | --- | --- |
|     |     |     |     |     |     |     |
|     |     |     |     |     |     |     |
|     |     |     |     |     |     |     |
|     |     |     |     |     |     |     |
|     |     |     |     |     |     |     |

## [Namespace types exports](#namespace-types-exports)

Many Mantine components and hooks now provide namespace exports for related types. For example, [use-disclosure](https://mantine.dev/hooks/use-disclosure/) hook types can now be accessed like this:

Example of using namespace types with [Button](https://mantine.dev/core/button/) props type:

## [Font weights](#font-weights)

New `fontWeights` property was added to the [theme object](https://mantine.dev/theming/theme-object/). It allows you to control `font-weight` values used across all components. The default values are:

- `regular` – `400`
- `medium` – `600`
- `bold` – `700`

Each value is mapped to a CSS variable: `--mantine-font-weight-regular`, `--mantine-font-weight-medium`, `--mantine-font-weight-bold`. All components that previously used hardcoded `font-weight` values now use these CSS variables.

For example, to revert the medium font weight from `600` back to `500` (the default in Mantine 8):

## [@mantine/mcp-server package](#mantinemcp-server-package)

Mantine now includes `@mantine/mcp-server` package that exposes Mantine documentation over [Model Context Protocol](https://modelcontextprotocol.io/). It allows AI tools to query Mantine docs and props data through MCP tools instead of raw web scraping.

The server uses static data generated from Mantine documentation and serves:

- item discovery with `list_items`
- full documentation page retrieval with `get_item_doc`
- normalized props metadata with `get_item_props`
- keyword-based lookup with `search_docs`

This setup is useful in agent workflows where tools can call MCP functions directly to retrieve structured data and reduce prompt size.

Basic server configuration:

For setup details, supported tools, and client-specific instructions, see [Mantine with LLMs](https://mantine.dev/guides/llms/).

## [Mantine skills for Claude Code and Codex](#mantine-skills-for-claude-code-and-codex)

Mantine skills for AI coding agents are documented in the [Mantine with LLMs](https://mantine.dev/guides/llms/) guide.

The guide includes:

- available skills in [`mantinedev/skills`](https://github.com/mantinedev/skills)
- installation commands for each skill
- separate usage instructions for Claude Code and Codex

## [New use-form validators](#new-use-form-validators)

New `isUrl` and `isOneOf` [validators](https://mantine.dev/form/validators/) were added to `@mantine/form` package:

- `isUrl` – validates that the value is a valid URL. Supports custom protocols and localhost option.
- `isOneOf` – validates that the value is included in the given list of allowed values.

## [Standard Schema support in use-form](#standard-schema-support-in-use-form)

`@mantine/form` now has built-in support for [Standard Schema](https://standardschema.dev/), a community specification implemented by Zod v4, Valibot, ArkType, and other schema libraries. Use `schemaResolver` to validate forms with any compliant library without installing a separate resolver package:

Pass `{ sync: true }` when your schema is synchronous to get synchronous return types for `form.validate()`, `form.validateField()`, and `form.isValid()`.

## [AppShell static mode](#appshell-static-mode)

[AppShell](https://mantine.dev/core/app-shell/) component now supports `mode="static"` which renders all AppShell elements as part of the normal document flow using CSS Grid instead of fixed positioning. Static mode supports `layout="alt"` to place navbar and aside at full height with header and footer adjusted between them. See [AppShell examples](https://mantine.dev/app-shell/?e=BasicAppShell) for more details.

## [ScrollArea startScrollPosition](#scrollarea-startscrollposition)

`ScrollArea` component now supports `startScrollPosition` prop to set the initial scroll position when the component mounts:

## [useEffectEvent migration in hooks](#useeffectevent-migration-in-hooks)

Five hooks — `usePageLeave`, `useWindowEvent`, `useHotkeys`, `useClickOutside`, and `useCollapse` — have been updated to use React 19's stable `useEffectEvent`. Previously these hooks captured stale closures or caused unnecessary event listener re-registrations when non-memoized callbacks were passed. With `useEffectEvent`, each hook registers a single stable listener that always calls the latest version of the provided callback, so wrapping callbacks in `useCallback` or `useMemo` is no longer required.

## [React 19 Activity for keepMounted](#react-19-activity-for-keepmounted)

[Transition](https://mantine.dev/core/transition/), [Collapse](https://mantine.dev/core/collapse/), [Tabs.Panel](https://mantine.dev/core/tabs/), [Stepper](https://mantine.dev/core/stepper/), and [Tree](https://mantine.dev/core/tree/) now use React 19's [Activity](https://react.dev/reference/react/Activity) component when `keepMounted` is set. `Activity` preserves the state of hidden subtrees — form inputs, scroll positions, and any other component state survive while the content is not visible. `Stepper` and `Tree` gain a new `keepMounted` prop; all other components already had it.

## [Documentation updates](#documentation-updates)

- New [Custom components](https://mantine.dev/guides/custom-components/) guide explaining how to create custom components with Mantine's styling system
- New [Controlled vs Uncontrolled](https://mantine.dev/guides/controlled-vs-uncontrolled/) guide explaining differences between controlled and uncontrolled components
- [HueSlider](https://mantine.dev/core/hue-slider/) and [AlphaSlider](https://mantine.dev/core/alpha-slider/) components now have their own documentation pages
- Uncontrolled documentation and usage with `FormData` section was added to all inputs components
- [JsonInput](https://mantine.dev/core/json-input/) documentation now includes custom serialization example with `superjson` library
- [Pagination](https://mantine.dev/core/pagination/) documentation now includes URL synchronization examples for Next.js, react-router-dom and nuqs
- [use-form](https://mantine.dev/form/use-form/) documentation now includes separate examples with [all Mantine inputs](https://mantine.dev/form/all-inputs/)

## [Other changes](#other-changes)

- [Notifications](https://mantine.dev/x/notifications/) component now pauses auto close timer of all visible notifications when any notification is hovered (new default). Use `pauseResetOnHover="notification"` to keep the previous behavior of pausing only the hovered notification.
- [useHeadroom](https://mantine.dev/hooks/use-headroom/) hook now returns `{ pinned: boolean; scrollProgress: number }` object instead of a plain `boolean`. `scrollProgress` is a value between `0` (fully hidden) and `1` (fully visible) that can be used for scroll-linked reveal animations. A new `scrollDistance` option controls how many pixels of scrolling are required to fully reveal or hide the element (default: `100`).
- New [useScrollDirection](https://mantine.dev/hooks/use-scroll-direction/) hook detects whether the user is currently scrolling up or down. It returns `'up'`, `'down'`, or `'unknown'`, handles resize events to avoid false direction changes, and always uses the latest state without stale closure issues.
- Default `theme.defaultRadius` was changed from `sm` (`4px`) to `md` (`8px`)
- `light` variant in all components now uses different colors values without transparency to improve contrast
- `mod` prop now converts camelCase keys to kebab-case for data attributes in all components
- `@mantine/form` package now includes built-in [Standard Schema](https://mantine.dev/form/schema-validation/) support via `schemaResolver`
- `@mantine/form` `getInputProps` now supports `type: 'radio'` for individual radio inputs – returns `checked`/`defaultChecked` and passes through the radio option `value`
- `@mantine/form` now supports async validation rules. `form.validate()`, `form.validateField()` and `form.isValid()` return results directly when all rules are synchronous and return promises only when async rules are present. New `form.validating`, `form.isValidating(path)`, `validateDebounce` and `resolveValidationError` options were added.
- `createPolymorphicComponent` function was renamed to shorter `polymorphic` for convenience
- Mantine components now use theme-controlled `fontWeights` values. The default `medium` font weight was changed from `500` to `600` for better readability.
- All Mantine components now support logical margin and padding style props:
- `mis` - margin-inline-start
- `mie` - margin-inline-end
- `pis` - padding-inline-start
- `pie` - padding-inline-end
- [Tree](https://mantine.dev/core/tree/) component now supports controlled state via `expandedState`, `selectedState` and `checkedState` props.
- [Tree](https://mantine.dev/core/tree/) component no longer defines `data-hovered` attribute for hover state, you need to apply hover styles with `&:hover` instead. This change improves rendering performance by [resolving this issue](https://github.com/mantinedev/mantine/issues/7266).
- [Collapse](https://mantine.dev/core/collapse/) component now uses `expanded` prop instead of `in`
- [Collapse](https://mantine.dev/core/collapse/), [NavLink](https://mantine.dev/core/nav-link/) and [Accordion.Panel](https://mantine.dev/core/accordion/) now support `keepMounted={false}` prop to unmount collapsed content
- [Select](https://mantine.dev/core/select/) and [MultiSelect](https://mantine.dev/core/multi-select/) components now support primitive value types (numbers, booleans, strings) for data and value
- [MultiSelect](https://mantine.dev/core/multi-select/) now supports `onMaxValues` prop, which is called when the user attempts to select more values than `maxValues`
- [TagsInput](https://mantine.dev/core/tags-input/) component now supports `onMaxTags` prop, which is called when the user attempts to add more tags than `maxTags`
- [Accordion](https://mantine.dev/core/accordion/) component now supports `ref` prop
- [Text](https://mantine.dev/core/text/) and [Anchor](https://mantine.dev/core/anchor/) components no longer accept `color` prop, use `c` style prop instead
- [PasswordInput](https://mantine.dev/core/password-input/) component visibility toggle icon was updated
- [Popover](https://mantine.dev/core/popover/) and [Tooltip](https://mantine.dev/core/tooltip/) components no longer accept `positionDependencies` prop, it is no longer required
- [TypographyStylesProvider](https://mantine.dev/core/typography/) component was renamed to [Typography](https://mantine.dev/core/typography/)
- [Checkbox](https://mantine.dev/core/checkbox/) component now supports `readOnly` and `withErrorStyles` props
- [Spoiler](https://mantine.dev/core/spoiler/) component:
- `initialState` prop was renamed to `defaultExpanded` for consistency with other components
- New `showAriaLabel` and `hideAriaLabel` props allow customizing ARIA labels
- [Checkbox.Group](https://mantine.dev/core/checkbox/#checkboxgroup-with-formdata) and [Switch.Group](https://mantine.dev/core/switch/#switchgroup-with-formdata) can now be used in uncontrolled forms and can be accessed through `FormData`
- [ColorPicker](https://mantine.dev/core/color-picker/) component now supports `name` and `hiddenInputProps` props to include color value in uncontrolled form submissions
- [Dialog](https://mantine.dev/core/dialog/) now enables `withBorder` by default
- [Pagination](https://mantine.dev/core/pagination/) component now supports `input-` prefix for `size` prop to match input and button sizes
- [FloatingIndicator](https://mantine.dev/core/floating-indicator/) component now supports `onTransitionStart` and `onTransitionEnd` callbacks
- [LoadingOverlay](https://mantine.dev/core/loading-overlay/) component now supports `onEnter`, `onEntered`, `onExit` and `onExited` callbacks
- [Grid](https://mantine.dev/core/grid/) component `gutter` prop was renamed to `gap` for consistency with other layout components. New `rowGap` and `columnGap` props allow separate control of row and column spacing. [Grid.Col](https://mantine.dev/core/grid/) now supports `align` prop for per-column vertical alignment.
- [Indicator](https://mantine.dev/core/indicator/) component now supports:
- `maxValue` prop to display `{maxValue}+` when the label exceeds the maximum value
- `showZero` prop (default `true`) to control visibility of indicator with label `0`
- `offset` prop object with `x` and `y` properties for separate horizontal and vertical offsets
- [NumberInput](https://mantine.dev/core/number-input/) component now supports:
- `onMinReached` and `onMaxReached` callbacks
- `selectAllOnFocus` prop to select all text when input is focused
- `bigint` values for `value`, `defaultValue`, `onChange`, `min`, `max`, `step` and `startValue` (with `string` fallback for intermediate states)
- [RingProgress](https://mantine.dev/core/ring-progress/) component now supports
- `sectionGap` prop to add visual separation between sections in degrees
- `startAngle` prop to control where the progress starts (0 = right, 90 = bottom, 180 = left, 270 = top)
- [List](https://mantine.dev/core/list/) component now supports HTML5 list attributes: `start`, `reversed`, and `value` props for enhanced semantic HTML support
- [JsonInput](https://mantine.dev/core/json-input/) component now supports `indentSpaces` prop to control the number of spaces used for formatting JSON
- [Rating](https://mantine.dev/core/rating/) component now supports `allowClear` prop to reset rating to 0 by clicking the same value
- [ScrollArea](https://mantine.dev/core/scroll-area/) component now supports `onLeftReached` and `onRightReached` callbacks for horizontal scroll boundaries
- [Slider](https://mantine.dev/core/slider/) and [RangeSlider](https://mantine.dev/core/range-slider/) now support hidden marks with `hidden: true` property. Hidden marks allow snapping to specific values without displaying them visually, useful with `restrictToMarks` prop.
- [use-tree](https://mantine.dev/core/tree/) no longer supports callback state setters for `setExpandedState`, `setSelectedState`, and `setCheckedState` functions
- [use-fullscreen](https://mantine.dev/hooks/use-fullscreen/) hook was split into two hooks: `useFullscreenElement` and `useFullscreenDocument`
- [use-media-query](https://mantine.dev/hooks/use-media-query/) hook no longer includes fallback for old Safari versions (iOS 13 and earlier, released before 2019)
- [use-resize-observer](https://mantine.dev/hooks/use-resize-observer/) now uses the new callback ref approach. The new approach makes hook usable with dynamic node changes. This change might be breaking, validate hook usage in your application.
- [use-mouse](https://mantine.dev/hooks/use-mouse/) hook now uses the new callback ref approach to resolve the issue with stale refs. The previous hook functionality was split into two hooks: `useMouse` (for ref) and `useMousePosition` (for document).
- [use-mutation-observer](https://mantine.dev/hooks/use-mutation-observer/) hook now uses the new callback ref approach. The new approach makes hook usable with dynamic node changes. Additionally, a new `useMutationObserverTarget` hook was added for observing external target elements.
- [use-disclosure](https://mantine.dev/hooks/use-disclosure/) hook now supports new `set` handler
- [use-floating-indicator](https://mantine.dev/hooks/use-floating-indicator/) hook now supports `onTransitionStart` and `onTransitionEnd` callbacks
- `@mantine/hooks` types were renamed for consistency:
- `UseScrollSpyReturnType` → `UseScrollSpyReturnValue`
- `StateHistory` → `UseStateHistoryValue`
- `OS` → `UseOSReturnValue`
