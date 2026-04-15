## [Migration to native CSS](#migration-to-native-css)

Mantine no longer depends on [Emotion](https://emotion.sh/) for styles generation. All `@mantine/*` packages are now shipped with native CSS files which can be imported from `@mantine/{package}/styles.css`, for example:

This change improves performance, reduces bundle size of the library and allows using Mantine in environments where CSS-in-JS is not supported (or supported with limitations), for example, Next.js app directory.

Important breaking changes:

- `createStyles` function is no longer available, use [CSS modules](https://mantine.dev/styles/css-modules/) or any other styling solution of your choice instead
- Components no longer support `sx` prop. You can use `className` or `style` props instead.
- `styles` prop no longer supports nested selectors

It is now recommended to use [CSS modules](https://mantine.dev/styles/css-modules/) to style Mantine components. To update your project to [CSS modules](https://mantine.dev/styles/css-modules/), follow the [6.x → 7.x migration guide](https://mantine.dev/guides/6x-to-7x/).

## [Vanilla extract integration](#vanilla-extract-integration)

If you prefer CSS-in-JS syntax for styling, you can use [Vanilla extract](https://mantine.dev/styles/vanilla-extract/) as a TypeScript CSS preprocessor. You will be able to use most of Mantine styling features with [Vanilla extract](https://mantine.dev/styles/vanilla-extract/).

## [System color scheme support](#system-color-scheme-support)

All components now support system color scheme – when `colorScheme` value is `auto`, components will use `prefers-color-scheme` media query to determine if the user prefers light or dark color scheme.

Note that `auto` is not the default value. You need to set it manually to enable system color scheme support both on [MantineProvider](https://mantine.dev/theming/mantine-provider/) and in [ColorSchemeScript](https://mantine.dev/theming/color-schemes/#colorschemescript):

## [Built-in color scheme manager](#built-in-color-scheme-manager)

[MantineProvider](https://mantine.dev/theming/mantine-provider/) now comes with a built-in color scheme manager. It is no longer required to use any other components to set up color scheme logic. Color scheme can be changed with [useMantineColorScheme hook](https://mantine.dev/theming/color-schemes/#use-mantine-color-scheme-hook):

## [CSS modules and PostCSS preset](#css-modules-and-postcss-preset)

[CSS modules](https://mantine.dev/styles/css-modules/) is now the recommended way to style Mantine components, although it is not required – you can choose any other styling solution of your choice.

It is also recommended to use [postcss-preset-mantine](https://mantine.dev/styles/postcss-preset/). It includes mixins and functions to simplify styling of Mantine components. [postcss-preset-mantine](https://mantine.dev/styles/postcss-preset/) is included in all templates.

## [Global styles](#global-styles)

Mantine no longer includes normalize.css. Instead, it uses a bare minimum set of [global styles](https://mantine.dev/styles/global-styles/). These styles are part of the `@mantine/core` package and are applied automatically when you import `@mantine/core/styles.css` in your application. Note that these styles cannot be decoupled from the rest of the library.

## [Mantine as a headless UI library](#mantine-as-a-headless-ui-library)

You can now use Mantine as a [headless](https://mantine.dev/styles/unstyled/) library. To achieve that, just do not import `@mantine/*/styles.css` in your application. Then you will be able to apply styles with [Styles API](https://mantine.dev/styles/styles-api/).

## [createTheme function](#createtheme-function)

`createTheme` function is a replacement for `MantineThemeOverride` type. Use it to create a theme override, it will give you autocomplete for all theme properties:

## [Components extend functions](#components-extend-functions)

All components that support [default props](https://mantine.dev/theming/default-props/) or [Styles API](https://mantine.dev/styles/styles-api/) now have a static `extend` function which allows getting autocomplete when customizing [defaultProps](https://mantine.dev/theming/default-props/), [classNames and styles](https://mantine.dev/styles/styles-api/) of the component on [theme](https://mantine.dev/theming/theme-object/):

## [classNames based on component props](#classnames-based-on-component-props)

You can now get component props in [classNames and styles](https://mantine.dev/styles/styles-api/) to conditionally apply styles. This feature is a more powerful replacement for styles params.

Required input

Input with error

## [Components CSS variables](#components-css-variables)

You can now customize components [CSS variables](https://mantine.dev/styles/styles-api/) to change component styles based on its props. For example, it can be used to add new [sizes](https://mantine.dev/styles/variants-sizes/):

## [New variants system](#new-variants-system)

All components now have `data-variant` attribute on the root element, even if the component does not have any predefined variants. You can use it to apply styles to all components of the same type on [theme](https://mantine.dev/theming/theme-object/):

## [New sizes system](#new-sizes-system)

There are multiple ways to customize component sizes:

- With `data-size` attribute
- With component [CSS variables](https://mantine.dev/styles/styles-api/)
- With [static CSS variables](https://mantine.dev/styles/variants-sizes/#sizes-with-static-css-variables)

Example of customizing [Button](https://mantine.dev/core/button/) size with `data-size` attribute:

## [theme.variantColorResolver](#themevariantcolorresolver)

[Button](https://mantine.dev/core/button/), [Badge](https://mantine.dev/core/badge/), [ActionIcon](https://mantine.dev/core/action-icon/), [ThemeIcon](https://mantine.dev/core/theme-icon/) and other components now support custom variants with [variantColorResolver](https://mantine.dev/theming/colors/#colors-variant-resolver) – it supports both changing colors of existing variants and adding new variants.

## [rem units scaling](#rem-units-scaling)

It is now possible to scale [rem](https://mantine.dev/styles/rem/#rem-units-scaling) units. It is useful when you want to change font-size of `html`/`:root` element and preserve Mantine components sizes. For example, if you would like to set `html` font-size to `10px` and scale Mantine components accordingly, you need to set `scale` to `1 / (10 / 16)` (16 – default font-size) = `1 / 0.625` = `1.6`:

## [color prop improvements](#color-prop-improvements)

All components that support `color` prop now support the following color values:

- Key of `theme.colors`, for example, `blue`
- `theme.colors` index reference, for example, `blue.5`
- Any valid CSS color value, for example, `#fff`, `rgba(0, 0, 0, 0.5)`, `hsl(0, 0%, 100%)`

Filled variant

Light variant

Outline variant

## [Components classes](#components-classes)

Classes of each component are now available in `Component.classes` object. For example, you can find [Button](https://mantine.dev/core/button/) classes in `Button.classes`:

| Key          | Class      |
| ------------ | ---------- |
| root         | m_77c9d27d |
| inner        | m_80f1301b |
| label        | m_811560b9 |
| section      | m_a74036a  |
| loader       | m_a25b86ee |
| group        | m_80d6d844 |
| groupSection | m_70be2a01 |

You can use these classes to create components with the same styles as Mantine components:

## [Theme object changes](#theme-object-changes)

- `theme.lineHeight` is now `theme.lineHeights` – it is now possible to specify multiple line heights. `theme.lineHeights` values are used in the [Text](https://mantine.dev/core/text/) component.
- `theme.colorScheme` is no longer available, use [useMantineColorScheme](https://mantine.dev/theming/color-schemes/#use-mantine-color-scheme-hook) to get color scheme value
- `theme.dir` is no longer needed, direction is now managed by [DirectionProvider](https://mantine.dev/styles/rtl/)
- `theme.loader` was removed, you can now configure default loader with [default props](https://mantine.dev/theming/default-props/) of [Loader](https://mantine.dev/core/loader/) component
- `theme.transitionTimingFunction` was removed
- `theme.focusRingStyles` was replaced with `theme.focusClassName`
- `theme.activeStyles` was replaced with `theme.activeClassName`
- `theme.globalStyles` was removed
- `theme.fn` functions were removed, some of the functions are available as [standalone utilities](https://mantine.dev/styles/color-functions/)
- New [theme.scale](https://mantine.dev/styles/rem/#rem-units-scaling) property controls rem units scaling
- New `theme.fontSmoothing` property determines whether font smoothing styles should be applied to the body element
- New [theme.variantColorResolver](https://mantine.dev/theming/colors/#colors-variant-resolver) property allows customizing component colors per variant

## [Colors generator](#colors-generator)

New [@mantine/colors-generator](https://mantine.dev/theming/colors/#colors-generation) package is now available to generate color palettes based on single color value. It is also available as [online tool](https://mantine.dev/colors-generator/). Note that it is usually better to generate colors in advance to avoid contrast issues.

## [New setup for RTL](#new-setup-for-rtl)

`@mantine/core` package now exports [DirectionProvider](https://mantine.dev/styles/rtl/) component, which should be used to configure the direction of the application. `useDirection` hook can be used to toggle direction. All components now include RTL styles by default, it is no longer required to set up additional plugins. See [RTL documentation](https://mantine.dev/styles/rtl/) to learn more.

## [React 18+ only](#react-18-only)

Starting from version 7.0 Mantine no longer supports older React versions. The minimum supported version is now React 18. It is required because Mantine components now use [useId](https://react.dev/reference/react/useId) and [useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore) hooks, which are available only in React 18.

## [left and right section](#left-and-right-section)

Components that previously had `rightSection` and `icon` props, now use `leftSection` instead of `icon`. Example of [Button](https://mantine.dev/core/button/) sections:

## [NumberInput changes](#numberinput-changes)

[NumberInput](https://mantine.dev/core/number-input/) was migrated to [react-number-format](https://s-yadav.github.io/react-number-format/). It now supports more features and has improvements in cursor position management. Due to migration, some of the props were renamed – follow the [documentation](https://mantine.dev/core/number-input/) to learn about the changes.

With prefix

With suffix

## [Loader changes](#loader-changes)

[Loader](https://mantine.dev/core/loader/) component is now built with CSS only. This change improves performance and reduces HTML output of the component.

Color

Size

Type

Oval

Bars

Dots

[Theme](https://mantine.dev/theming/theme-object/) object no longer supports `theme.loader` property – it is also now possible to add custom loaders on [theme](https://mantine.dev/theming/theme-object/) with [default props](https://mantine.dev/theming/default-props/). Specified [Loader](https://mantine.dev/core/loader/) will be used in all components that use it under the hood ([LoadingOverlay](https://mantine.dev/core/loading-overlay/), [Button](https://mantine.dev/core/button/), [ActionIcon](https://mantine.dev/core/action-icon/), [Stepper](https://mantine.dev/core/stepper/), etc.).

## [Progress changes](#progress-changes)

[Progress](https://mantine.dev/core/progress/) component now supports compound components pattern. Advanced features that were previously implemented in [Progress](https://mantine.dev/core/progress/) are now supposed to be implemented with compound components instead.

Documents

Photos

Other

## [Table changes](#table-changes)

[Table](https://mantine.dev/core/table/) component changes:

- [Styles API](https://mantine.dev/styles/styles-api/) support
- It is now required to use compound components instead of elements: `Table.Tr`, `Table.Td`, etc.
- It is now easier to override styles – all styles are added with classes instead of deeply nested selectors on root element
- New props: `borderColor`, `withRowBorders`, `stripedColor`, `highlightOnHoverColor`
- `withBorder` prop was renamed to `withTableBorder`
- `fontSize` prop was removed, use `fz` [style prop](https://mantine.dev/styles/style-props/) instead
- New `Table.ScrollContainer` component to create scrollable table

| Element position | Element name | Symbol | Atomic mass |
| ---------------- | ------------ | ------ | ----------- |
| 6                | Carbon       | C      | 12.011      |
| 7                | Nitrogen     | N      | 14.007      |
| 39               | Yttrium      | Y      | 88.906      |
| 56               | Barium       | Ba     | 137.33      |
| 58               | Cerium       | Ce     | 140.12      |

## [Group changes](#group-changes)

[Group](https://mantine.dev/core/group/) component changes:

- `position` prop was renamed to `justify` – it now supports all `justify-content` values
- `noWrap` prop was replaced with `wrap="nowrap"`, `wrap` prop now supports all `flex-wrap` values
- `spacing` prop was replaced with `gap`
- `Group` now supports new `preventGrowOverflow` prop which allows customizing how group items will behave when they grow larger than their dedicated space

Justify

Gap

Grow

## [Tabs changes](#tabs-changes)

- Styles API selector `tabsList` renamed to `list`
- `TabProps` type was renamed to `TabsTabProps`
- `onTabChange` prop was renamed to `onChange`
- `Tabs.List` `position` prop was renamed to `justify`, it now supports all `justify-content` values

## [Button changes](#button-changes)

- `compact` prop was removed, use `size="compact-XXX"` instead
- `leftIcon` and `rightIcon` props were renamed to `leftSection` and `rightSection`
- `uppercase` prop was removed, use `tt` [style prop](https://mantine.dev/styles/style-props/) instead
- `loaderPosition` prop was removed, [Loader](https://mantine.dev/core/loader/) is now always rendered in the center to prevent layout shifts
- Styles API selectors were changed, see [Button Styles API](https://mantine.dev/core/button/?t=styles-api) documentation for more details

## [AppShell changes](#appshell-changes)

[AppShell](https://mantine.dev/core/app-shell/) component was completely rewritten, it now supports more features:

- `AppShell` now uses compound components pattern: `Navbar`, `Aside`, `Header` and `Footer` are no longer exported from `@mantine/core` package. Instead, use `AppShell.Navbar`, `AppShell.Aside`, etc.
- `AppShell` now supports animations when navbar/aside are opened/closed
- Navbar/aside can now be collapsed on desktop – state is handled separately for mobile and desktop
- Header/footer can now be collapsed the same way as navbar/aside. For example, the header can be collapsed based on scroll position or direction.
- `AppShell` no longer supports `fixed` prop – all components have `position: fixed` styles, static positioning is no longer supported
- The documentation was updated, it now includes [10+ examples on a separate page](https://mantine.dev/app-shell/?e=BasicAppShell)

## [SimpleGrid changes](#simplegrid-changes)

[SimpleGrid](https://mantine.dev/core/simple-grid/) now uses object format to define grid breakpoints and spacing, it works the same way as [style props](https://mantine.dev/styles/style-props/).

1

2

3

4

5

## [Grid changes](#grid-changes)

[Grid](https://mantine.dev/core/grid/) now uses object format in `gutter`, `offset`, `span` and order props, all props now work the same way as [style props](https://mantine.dev/styles/style-props/).

1

2

3

4

## [Image changes](#image-changes)

[Image](https://mantine.dev/core/image/) component changes:

- `Image` component no longer includes `figure` and other associated elements
- `caption` prop is no longer available
- `width` and `height` props are replaced with `w` and `h` [style props](https://mantine.dev/styles/style-props/)
- Placeholder functionality was replaced with fallback image

![](https://placehold.co/600x400?text=Placeholder)

## [Spotlight changes](#spotlight-changes)

[Spotlight](https://mantine.dev/x/spotlight/) changes:

- The logic is no longer based on React context
- `SpotlightProvider` was renamed to `Spotlight`
- `useSpotlight` hook was removed, use `spotlight` object instead
- `actions` prop now uses a different data format
- It is now possible to have multiple spotlights in the same app
- `Spotlight` component now uses compound components pattern for advanced customization

## [Carousel changes](#carousel-changes)

[Carousel](https://mantine.dev/x/carousel/) now uses object format for responsive values in `slideSize` and `slideGap` props instead of `breakpoints` prop:

Slide 1 of 6

1

2

3

4

5

6

## [@mantine/prism deprecation](#mantineprism-deprecation)

`@mantine/prism` package was deprecated in favor of `@mantine/code-highlight` package. [The new package](https://mantine.dev/x/code-highlight/) uses [highlight.js](https://highlightjs.org/) instead of [Prism](https://prismjs.com/).

## [Fieldset component](#fieldset-component)

New [Fieldset](https://mantine.dev/core/fieldset/) component:

Variant

Default

Filled

Unstyled

Radius

## [Combobox component](#combobox-component)

The new [Combobox](https://mantine.dev/core/combobox/) component allows building custom select, autocomplete, tags input, multiselect and other similar components. It is used as a base for updated [Autocomplete](https://mantine.dev/core/autocomplete/), [Select](https://mantine.dev/core/select/), [TagsInput](https://mantine.dev/core/tags-input/) and [MultiSelect](https://mantine.dev/core/multi-select/) components.

[Combobox](https://mantine.dev/core/combobox/) is very flexible and allows you to have full control over the component rendering and logic. Advanced features that were previously implemented in [Autocomplete](https://mantine.dev/core/autocomplete/), [Select](https://mantine.dev/core/select/) and [MultiSelect](https://mantine.dev/core/multi-select/) are now supposed to be implemented with [Combobox](https://mantine.dev/core/combobox/) instead.

You can find 50+ `Combobox` examples on [this page](https://mantine.dev/combobox/).

## [TagsInput component](#tagsinput-component)

New [TagsInput](https://mantine.dev/core/tags-input/) component based on [Combobox](https://mantine.dev/core/combobox/) component. The component is similar to [MultiSelect](https://mantine.dev/core/multi-select/) but allows entering custom values.

## [withErrorStyles prop](#witherrorstyles-prop)

All inputs now support `withErrorStyles` prop, which allows removing error styles from the input. It can be used to apply custom error styles without override, or use other techniques to indicate error state. For example, it can be used to render an icon in the right section:

Error as boolean

Error as react node

Something went wrong

Without error styles on input

Something went wrong

## [hiddenFrom and visibleFrom props](#hiddenfrom-and-visiblefrom-props)

All Mantine components now support `hiddenFrom` and `visibleFrom` props. These props accept breakpoint (`xs`, `sm`, `md`, `lg`, `xl`) and hide the component when viewport width is less than or greater than the specified breakpoint:

## [Other changes](#other-changes)

- New [VisuallyHidden](https://mantine.dev/core/visually-hidden/) component
- New [ActionIcon.Group](https://mantine.dev/core/action-icon/#actionicongroup) component
- All transitions are now disabled during color scheme change
- `theme.respectReducedMotion` is now set to `false` by default – it caused a lot of confusion for users who did not know about it
- [Notifications system](https://mantine.dev/x/notifications/) now exports `notifications.updateState` function to update notifications state with a given callback
- [Blockquote](https://mantine.dev/core/blockquote/) component has new design
- [Breadcrumbs](https://mantine.dev/core/breadcrumbs/) component now supports `separatorMargin` prop
- [Tooltip](https://mantine.dev/core/tooltip/) component now supports `mainAxis` and `crossAxis` offset configuration
- [Slider and RangeSlider](https://mantine.dev/core/slider/) components `radius` prop now affects thumb as well as track
- [NativeSelect](https://mantine.dev/core/native-select/) component now supports setting options as `children` and options groups
- [Anchor](https://mantine.dev/core/anchor/) component now supports `underline` prop which lets you configure how link will be underlined: `hover` (default), `always` or `never`
- [Affix](https://mantine.dev/core/affix/) component no longer supports `target` prop, use `portalProps` instead
- [Drawer](https://mantine.dev/core/drawer/) component no longer supports `target` prop, use `portalProps` instead: `portalProps={{ target: '.your-selector' }}`
- [Container](https://mantine.dev/core/container/) component no longer supports `sizes` prop, use [CSS variables](https://mantine.dev/styles/styles-api/) to customize sizes on [theme](https://mantine.dev/theming/theme-object/) instead
- `useComponentDefaultProps` hook was renamed to [useProps](https://mantine.dev/theming/default-props/#useprops-hook)
- `withinPortal` prop is now true by default in all overlay components ([Popover](https://mantine.dev/core/popover/), [HoverCard](https://mantine.dev/core/hover-card/), [Tooltip](https://mantine.dev/core/tooltip/), etc.)
- `AlphaSlider` and `HueSlider` components are no longer available, they can be used only as a part of [ColorPicker](https://mantine.dev/core/color-picker/)
- [Text](https://mantine.dev/core/text/) default root element is now `<p />`
- [Title](https://mantine.dev/core/title/) no longer supports all [Text](https://mantine.dev/core/text/) props, only [style props](https://mantine.dev/styles/style-props/) are available
- `MediaQuery` component was removed – use [CSS modules](https://mantine.dev/styles/css-modules/) to apply responsive styles
- [Highlight](https://mantine.dev/core/highlight/) component prop `highlightColor` was renamed to `color`
- [Tooltip and Tooltip.Floating](https://mantine.dev/core/tooltip/) components no longer support `width` prop, use `w` [style prop](https://mantine.dev/styles/style-props/) instead
- [Stack](https://mantine.dev/core/stack/) component `spacing` prop was renamed to `gap`
- [Input](https://mantine.dev/core/input/) and other `Input` based components `icon` prop was renamed to `leftSection`
- [Loader](https://mantine.dev/core/loader/) component `variant` prop was renamed to `type`
- `@mantine/core` package no longer depends on [Radix UI ScrollArea](https://www.radix-ui.com/docs/primitives/components/scroll-area#scroll-area), [ScrollArea](https://mantine.dev/core/scroll-area/) component is now a native Mantine component – it reduces bundle size, allows setting CSP for styles and improves performance (all styles are now applied with classes instead of inline `<style />` tags)
- [Overlay](https://mantine.dev/core/overlay/) `opacity` prop was renamed to `backgroundOpacity` to avoid collision with `opacity` [style prop](https://mantine.dev/styles/style-props/)
- [Badge](https://mantine.dev/core/badge/) Styles API selectors were changed, see [Badge Styles API](https://mantine.dev/core/badge/?t=styles-api) documentation for more details
- [Slider](https://mantine.dev/core/slider/) Styles API selectors were changed, see [Slider Styles API](https://mantine.dev/core/slider/?t=styles-api) documentation for more details
- [Text](https://mantine.dev/core/text/) component no longer supports `underline`, `color`, `strikethrough`, `italic`, `transform`, `align` and `weight` prop – use [style props](https://mantine.dev/styles/style-props/) instead
- [Portal](https://mantine.dev/core/portal/) component `innerRef` prop was renamed to `ref`
- [ScrollArea](https://mantine.dev/core/scroll-area/) now supports `x` and `y` values in `offsetScrollbars` prop
- `TransferList` component is no longer available as a part of `@mantine/core` package, instead you can implement it with [Combobox](https://mantine.dev/core/combobox/) component ([example](https://mantine.dev/combobox/?e=TransferList))
- [Chip](https://mantine.dev/core/chip/) component now supports custom check icon
- [PasswordInput](https://mantine.dev/core/password-input/) no longer supports `visibilityToggleLabel` and `toggleTabIndex` props, use `visibilityToggleButtonProps` prop instead
- [Stepper](https://mantine.dev/core/stepper/) no longer supports `breakpoint` prop, you can apply responsive styles with Styles API
- [ColorInput](https://mantine.dev/core/color-input/) no longer supports `dropdownZIndex`, `transitionProps`, `withinPortal`, `portalProps` and `shadow` props, you can now pass these props with `popoverProps` prop
- [LoadingOverlay](https://mantine.dev/core/loading-overlay/) props are now grouped by the component they are passed down to: `overlayProps`, `loaderProps` and `transitionProps` now replace props that were previously passed to `LoadingOverlay` directly
- [Dropzone](https://mantine.dev/x/dropzone/) component no longer supports `padding` prop, use `p` style prop instead
- [Dialog](https://mantine.dev/core/dialog/) component now supports all [Paper](https://mantine.dev/core/paper/) and [Affix](https://mantine.dev/core/affix/) props, `transitionDuration`, `transition` and other transition related props were replaced with `transitionProps`
- [Checkbox](https://mantine.dev/core/checkbox/), [Radio](https://mantine.dev/core/radio/), [Chip](https://mantine.dev/core/chip/) and [Switch](https://mantine.dev/core/switch/) components now support `rootRef` prop which allows using them with [Tooltip](https://mantine.dev/core/tooltip/) and other similar components
- [Grid](https://mantine.dev/core/grid/) no longer has `overflow: hidden` styles by default, you can enable it by setting `overflow` prop to `hidden`
