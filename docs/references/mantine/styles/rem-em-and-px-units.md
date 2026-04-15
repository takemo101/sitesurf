## [rem units](#rem-units)

All Mantine components use `rem` units to apply size styles (`margin`, `padding`, `width`, etc.). By default, `1rem` is considered to be `16px`, as it is the default setting in most browsers. All components scale based on the user's browser font-size settings or font-size of the `html`/`:root`.

## [rem units scaling](#rem-units-scaling)

If you want to change the font-size of the `:root`/`html` element and preserve Mantine component sizes, set `scale` on the [theme](https://mantine.dev/theming/theme-object/) to the value of `1 / htmlFontSize`.

For example, if you set the `html` font-size to `10px` and want to scale Mantine components accordingly, you need to set `scale` to `1 / (10 / 16)` (16 – default font-size) = `1 / 0.625` = `1.6`:

## [em units](#em-units)

`em` units are used in media queries the same way as `rem` units, but they are not affected by the font-size specified on the `html`/`:root` element. `1em` is considered to be `16px`.

## [px conversions](#px-conversions)

You can use numbers in some Mantine components props. Numbers are treated as `px` and converted to `rem`, for example:

The same conversion happens in [style props](https://mantine.dev/styles/style-props/):

## [rem and em function](#rem-and-em-function)

`@mantine/core` package exports `rem` and `em` function that can be used to convert `px` into `rem`/`em`:

## [Convert rem to px](#convert-rem-to-px)

To convert `rem`/`em` to `px` use `px` function exported from `@mantine/core`:

## [rem/em functions in css files](#remem-functions-in-css-files)

You can use `rem` and `em` function in [css files](https://mantine.dev/styles/css-modules/) if [postcss-preset-mantine](https://mantine.dev/styles/postcss-preset/) is installed:

## [Convert px to rem automatically in css files](#convert-px-to-rem-automatically-in-css-files)

To convert `px` to `rem` automatically in css files, enable `autoRem` option in [postcss-preset-mantine](https://mantine.dev/styles/postcss-preset/) configuration:
