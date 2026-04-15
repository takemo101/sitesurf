# Theme object

Mantine theme is an object where your application's colors, fonts, spacing, border-radius, and other design tokens are stored.

## [Usage](#usage)

To customize the theme, pass a theme override object to [MantineProvider](https://mantine.dev/theming/mantine-provider/) `theme` prop. The theme override will be deeply merged with the default theme.

## [Theme properties](#theme-properties)

### [autoContrast](#autocontrast)

`autoContrast` controls whether text color should be changed based on the given `color` prop in the following components:

- [ActionIcon](https://mantine.dev/core/action-icon/) with `variant="filled"` only
- [Alert](https://mantine.dev/core/alert/) with `variant="filled"` only
- [Avatar](https://mantine.dev/core/avatar/) with `variant="filled"` only
- [Badge](https://mantine.dev/core/badge/) with `variant="filled"` only
- [Button](https://mantine.dev/core/button/) with `variant="filled"` only
- [Chip](https://mantine.dev/core/chip/) with `variant="filled"` only
- [NavLink](https://mantine.dev/core/nav-link/) with `variant="filled"` only
- [ThemeIcon](https://mantine.dev/core/theme-icon/) with `variant="filled"` only
- [Checkbox](https://mantine.dev/core/checkbox/) with `variant="filled"` only
- [Radio](https://mantine.dev/core/radio/) with `variant="filled"` only
- [Tabs](https://mantine.dev/core/tabs/) with `variant="pills"` only
- [SegmentedControl](https://mantine.dev/core/segmented-control/)
- [Stepper](https://mantine.dev/core/stepper/)
- [Pagination](https://mantine.dev/core/pagination/)
- [Progress](https://mantine.dev/core/progress/)
- [Indicator](https://mantine.dev/core/indicator/)
- [Timeline](https://mantine.dev/core/timeline/)
- [Spotlight](https://mantine.dev/x/spotlight/)
- All [@mantine/dates](https://mantine.dev/dates/getting-started/) components that are based on [Calendar](https://mantine.dev/dates/calendar/) component

`autoContrast` checks whether the given color luminosity is above or below the `luminanceThreshold` value and changes text color to either `theme.white` or `theme.black` accordingly.

`autoContrast` can be set globally on the theme level or individually for each component via the `autoContrast` prop, except for [Spotlight](https://mantine.dev/x/spotlight/) and [@mantine/dates](https://mantine.dev/dates/getting-started/) components which only support the global theme setting.

`autoContrast: true`

`autoContrast: false`

### [luminanceThreshold](#luminancethreshold)

`luminanceThreshold` controls which luminance value is used to determine if text color should be light or dark. It is used only if `theme.autoContrast` is set to `true`. The default value is `0.3`.

Color

Luminance threshold

### [focusRing](#focusring)

`theme.focusRing` controls focus ring styles, it supports the following values:

- `auto` (default and recommended) – focus ring is visible only when the user navigates with a keyboard, this is the default browser behavior for native interactive elements
- `always` – focus ring is visible when the user navigates with a keyboard and mouse, for example, the focus ring will be visible when the user clicks on a button
- `never` – focus ring is always hidden; it is not recommended – users who navigate with a keyboard will not have visual indication of the current focused element

Focus ring: `auto`

Focus ring: `always`

Focus ring: `never`

### [focusClassName](#focusclassname)

`theme.focusClassName` is a CSS class that is added to elements that have focus styles, for example, [Button](https://mantine.dev/core/button/) or [ActionIcon](https://mantine.dev/core/action-icon/). It can be used to customize focus ring styles of all interactive components except inputs. Note that when `theme.focusClassName` is set, `theme.focusRing` is ignored.

> **:focus-visible selector**
>
> `:focus-visible` selector is supported by more than [91% of browsers](https://caniuse.com/css-focus-visible) (data from April 2023). Safari browsers added support for it in version 15.4 (released in March 2022). If you need to support Safari 15.3 and older, you can use [focus-visible polyfill](https://github.com/WICG/focus-visible) or provide a [fallback](https://developer.mozilla.org/en-US/docs/Web/CSS/:focus-visible#providing_a_focus_fallback) with `:focus` pseudo-class.

### [activeClassName](#activeclassname)

`theme.activeClassName` is a CSS class that is added to elements that have active styles, for example, [Button](https://mantine.dev/core/button/) or [ActionIcon](https://mantine.dev/core/action-icon/). It can be used to customize active styles of all interactive components.

To disable active styles for all components, set `theme.activeClassName` to an empty string:

### [defaultRadius](#defaultradius)

`theme.defaultRadius` controls the default `border-radius` property in most components, for example, [Button](https://mantine.dev/core/button/) or [TextInput](https://mantine.dev/core/text-input/). You can set it to either one of the values from `theme.radius` or a number/string to use an exact value. Note that numbers are treated as pixels, but converted to rem. For example, `theme.defaultRadius: 4` will be converted to `0.25rem`. You can learn more about rem conversion in the [rem units guide](https://mantine.dev/styles/rem/).

TextInput with defaultRadius

Default radius

### [cursorType](#cursortype)

`theme.cursorType` controls the default cursor type for interactive elements that do not have `cursor: pointer` styles by default. For example, [Checkbox](https://mantine.dev/core/checkbox/) and [NativeSelect](https://mantine.dev/core/native-select/).

Default cursor

Pointer cursor

### [defaultGradient](#defaultgradient)

`theme.defaultGradient` controls the default gradient configuration for components that support `variant="gradient"` ([Button](https://mantine.dev/core/button/), [ActionIcon](https://mantine.dev/core/action-icon/), [Badge](https://mantine.dev/core/badge/), etc.).

### [fontWeights](#fontweights)

`theme.fontWeights` controls `font-weight` values used in all components. The default values are `regular: 400`, `medium: 600`, `bold: 700`. Each value is mapped to a CSS variable: `--mantine-font-weight-regular`, `--mantine-font-weight-medium`, `--mantine-font-weight-bold`.

For example, to revert the medium font weight from `600` back to `500` (the default in Mantine 8):

### [components](#components)

`theme.components` allows overriding of components' [default props](https://mantine.dev/theming/default-props/) and styles with `classNames` and `styles` properties. You can learn more about these features in the [default props](https://mantine.dev/theming/default-props/) and [Styles API](https://mantine.dev/styles/styles-api/) guides.

### [other](#other)

`theme.other` is an object that can be used to store any other properties that you want to access with the theme object.

## [Store theme override object in a variable](#store-theme-override-object-in-a-variable)

To store a theme override object in a variable, use the `createTheme` function:

## [Merge multiple theme overrides](#merge-multiple-theme-overrides)

Use the `mergeThemeOverrides` function to merge multiple themes into one theme override object:

## [use-mantine-theme hook](#use-mantine-theme-hook)

The `useMantineTheme` hook returns the theme object from [MantineProvider](https://mantine.dev/theming/mantine-provider/) context:

## [Default theme](#default-theme)

You can import the default theme object from the `@mantine/core` package. It includes all theme properties with default values. When you pass a theme override to [MantineProvider](https://mantine.dev/theming/mantine-provider/), it will be deeply merged with the default theme.

## [Access theme outside of components](#access-theme-outside-of-components)

To access theme outside of components, you need to create a full theme object (your theme override merged with the default theme).

Then you will be able to import it anywhere in your application:
