# Color functions

The `@mantine/core` package exports several functions that can be used to manipulate colors or extract information before using them as CSS values.

## [darken and lighten](#darken-and-lighten)

The `darken` and `lighten` functions can be used to manipulate color brightness. They accept a color in any format as the first argument and the amount of lightness to add/remove as the second argument.

## [alpha](#alpha)

The `alpha` function converts a color to rgba format with a given alpha channel. It is usually used to make colors more transparent. If it is not possible to convert the color to rgba format (for example, if the color is a CSS variable), the function will use [color-mix](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/color-mix). Note that `color-mix` is not supported in some older browsers. You can check [caniuse](https://caniuse.com/mdn-css_types_color_color-mix) for more information.

## [parseThemeColor](#parsethemecolor)

The `parseThemeColor` function returns information about a given color in the following format:

The `parseThemeColor` function can be used anywhere the `theme` object is available, for example in [CSS variables resolver](https://mantine.dev/styles/css-variables/), [variant color resolver](https://mantine.dev/theming/colors/#colors-variant-resolver), or component body:

## [getThemeColor](#getthemecolor)

`getThemeColor` is a simpler version of the `parseThemeColor` function. It accepts a color string as the first argument and a theme object as the second argument. It returns the parsed color value or CSS variable:

## [getGradient](#getgradient)

The `getGradient` function transforms a given `MantineGradient` object to a CSS gradient string:

## [isLightColor](#islightcolor)

The `isLightColor` function can be used to achieve better contrast between text and background:

## [luminance](#luminance)

The `luminance` function returns the color luminance. It can be used to check color contrast:
