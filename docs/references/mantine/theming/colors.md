# Colors

Mantine uses [open-color](https://yeun.github.io/open-color/) in the default theme with some additions. Each color has 10 shades.

Colors are exposed on the [theme object](https://mantine.dev/theming/theme-object/) as an array of strings. You can access a color shade by color name and index (0-9); colors with a larger index are darker:

Colors are also exposed as [CSS variables](https://mantine.dev/styles/css-variables/):

## [Adding extra colors](#adding-extra-colors)

You can add any number of extra colors to the `theme.colors` object. This will allow you to use them in all components that support the `color` prop, for example [Button](https://mantine.dev/core/button/), [Badge](https://mantine.dev/core/badge/), and [Switch](https://mantine.dev/core/switch/).

> **10 shades per color**
>
> A colors override must include **at least 10 shades per color**. Otherwise, you will get a TypeScript error and some variants will not have proper colors. If you only have one color value, you can either pick the remaining colors manually or use the [colors generator tool](https://mantine.dev/colors-generator/).
>
> You can add more than 10 shades per color: these values will not be used by Mantine components with the default colors resolver, but you can still reference them by index, for example, `color="blue.11"`.

## [Virtual colors](#virtual-colors)

A virtual color is a special color whose values should be different for light and dark color schemes. To define a virtual color, use the `virtualColor` function which accepts an object with the following properties as a single argument:

- `name` – color name, must be the same as the key in `theme.colors` object
- `light` – a key of `theme.colors` object for light color scheme
- `dark` – a key of `theme.colors` object for dark color scheme

To see the demo in action, switch between light and dark color schemes (`Ctrl + J`):

This box has virtual background color, it is pink in dark mode and cyan in light mode

## [colorsTuple](#colorstuple)

Use the `colorsTuple` function to:

- Use a single color as the same color for all shades
- Transform dynamic string arrays to Mantine color tuple (the array should still have 10 values)

## [Supported color formats](#supported-color-formats)

You can use the following color formats in `theme.colors`:

- HEX: `#fff`, `#ffffff`
- RGB: `rgb(255, 255, 255)`, `rgba(255, 255, 255, 0.5)`
- HSL: `hsl(0, 0%, 100%)`, `hsla(0, 0%, 100%, 0.5)`
- OKLCH: `oklch(96.27% 0.0217 238.66)`, `oklch(96.27% 0.0217 238.66 / 0.5)`

Example of adding an oklch color to theme:

## [primaryColor](#primarycolor)

`theme.primaryColor` is a key of `theme.colors`, it is used:

- As a default value for most of the components that support `color` prop
- To set default focus ring outline color

> **CSS color values at `theme.primaryColor`**
>
> The value of `theme.primaryColor` must be a key of the `theme.colors` object. For example, `blue`, `orange`, or `green`. You cannot assign CSS color values; for example, the following code will throw an error during theme merging:

## [primaryShade](#primaryshade)

`theme.primaryShade` is a number from 0 to 9. It determines which shade will be used for components that have a `color` prop.

Primary shade

You can also customize primary shade for dark and light color schemes separately:

## [Color prop](#color-prop)

Components that support changing their color have `color` prop. This prop supports the following values:

- Key of `theme.colors`, for example, `blue` or `green`
- Key of `theme.colors` with color index, for example, `blue.5` or `green.9`
- CSS color value, for example, `#fff` or `rgba(0, 0, 0, 0.5)`

Filled variant

Light variant

Outline variant

## [Colors index reference](#colors-index-reference)

You can reference colors by index in the `color` prop and [style props](https://mantine.dev/styles/style-props/), for example the `c` prop:

Text with blue.6 color

Index

## [Difference between color and c props](#difference-between-color-and-c-props)

The `color` prop is used to control multiple CSS properties of the component. These properties can vary across different components, but usually the `color` prop controls `background`, `color`, and `border-color` CSS properties. For example, when you set `color="#C3FF36"` on the [Button](https://mantine.dev/core/button/) component (with `variant="filled"`), it will set the following CSS properties:

- `background-color` to `#C3FF36`
- `background-color` when the button is hovered to `#B0E631` (`#C3FF36` darkened by 10%)
- `color` to `var(--mantine-color-white)`
- `border-color` to `transparent`

`c` is a [style prop](https://mantine.dev/styles/style-props/) – it is responsible for setting a single CSS property `color` (color of the text). You can combine both props to achieve better contrast between text and background. In the following example:

- The `color` prop sets `background: #C3FF36` and `color: var(--mantine-color-white)`
- The `c` prop overrides color styles to `color: var(--mantine-color-black)`

## [Colors variant resolver](#colors-variant-resolver)

`theme.variantColorResolver` is a function that is used to determine which colors will be used in different variants in the following components: [Alert](https://mantine.dev/core/alert/), [Avatar](https://mantine.dev/core/avatar/), [Button](https://mantine.dev/core/button/), [Badge](https://mantine.dev/core/badge/), and [ActionIcon](https://mantine.dev/core/action-icon/).

It accepts an object argument with the following properties:

`theme.variantColorResolver` must return an object with the following properties:

You can use `theme.variantColorResolver` to customize colors handling by default variants or to add support for new variants:

## [Colors generation](#colors-generation)

You can use the [colors generator](https://mantine.dev/colors-generator/) to generate 10 shades of color based on a single value or install the `@mantine/colors-generator` package to generate dynamic colors in your application:

The package exports a `generateColors` function that accepts a color value and returns an array of 10 shades. Note that the `generateColors` function works best with darker colors (blue, violet, red) and may produce colors with poor contrast for lighter colors (yellow, teal, orange). Usually, it's better to generate colors in advance to avoid contrast issues.

## [Default colors](#default-colors)

## [Add custom colors types](#add-custom-colors-types)

TypeScript will only autocomplete Mantine's default colors when accessing the theme. To add your custom colors to the MantineColor type, you can use TypeScript module declaration.
