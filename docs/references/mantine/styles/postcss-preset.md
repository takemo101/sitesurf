# PostCSS preset

`postcss-preset-mantine` provides several CSS functions and mixins to help you write styles. It is not required to use it, but is highly recommended. All demos that feature styles assume that you have this preset installed.

`postcss-preset-mantine` includes the following PostCSS plugins:

- [postcss-nested](https://www.npmjs.com/package/postcss-nested)
- [postcss-mixins](https://www.npmjs.com/package/postcss-mixins) with Mantine specific mixins
- Custom plugin with `em`/`rem` functions

## [Installation](#installation)

Install `postcss-preset-mantine` as a dev dependency:

## [Usage](#usage)

Note that setting up PostCSS may be different depending on your build tool/framework. Check a [dedicated framework guide](https://mantine.dev/getting-started/) to learn more. Add `postcss-preset-mantine` to your `postcss.config.cjs` file (usually it is located in the root of your project):

All done! You can now use all the features of the preset.

## [rem/em functions](#remem-functions)

`rem` and `em` functions can be used to convert pixels to rem/em units. `16px = 1rem` and `16px = 1em`. `em` values are supposed to be used in media queries, `rem` everywhere else. You can learn more about unit conversions in [this guide](https://mantine.dev/styles/rem/).

Will be transformed to:

## [Auto convert px to rem](#auto-convert-px-to-rem)

`autoRem` option can be used to automatically convert all pixel values to rem units in `.css` files:

This option works similar to `rem` function. The following code:

Will be transformed to:

Note that `autoRem` converts only CSS properties, values in `@media` queries are not converted automatically – you still need to use `em` function to convert them.

`autoRem` option does not convert values in the following cases:

- Values in `calc()`, `var()`, `clamp()` and `url()` functions
- Values in `content` property
- Values that contain `rgb()`, `rgba()`, `hsl()`, `hsla()` colors

If you want to convert above values to rem units, use `rem` function manually.

## [dark and light mixins](#dark-and-light-mixins)

`dark` and `light` mixins can be used to create styles that will be applied only in dark or light color scheme.

Will be transformed to:

Note that usually you do not need to use both `light` and `dark` mixins at the same time. It is easier to define styles for light color scheme and then use `dark` mixin to override them in dark color scheme.

To define values for light/dark color scheme on the `:root`/`html` element, use `light-root` and `dark-root` mixins instead:

## [smaller-than and larger-than mixins](#smaller-than-and-larger-than-mixins)

`smaller-than` and `larger-than` mixins can be used to create styles that will be applied only when the screen is smaller or larger than specified breakpoint.

Will be transformed to:

You can also use `smaller-than` and `larger-than` mixins with [mantine breakpoints](https://mantine.dev/styles/responsive/#breakpoints-variables-in-css-modules):

## [light-dark function](#light-dark-function)

`light-dark` function is an alternative to `light` and `dark` mixins. It accepts two arguments: first argument is rule that will be applied in light color scheme, second argument is rule that will be applied in dark color scheme.

Will be transformed to:

Note that `light-dark` function does not work on `:root`/`html` element. Use `light-root` and `dark-root` mixins instead:

## [alpha function](#alpha-function)

`alpha` function can be used to add alpha channel to color. Note that it uses [color-mix](https://caniuse.com/mdn-css_types_color_color-mix) which is not supported in some older browsers.

Will be transformed to:

## [lighten and darken functions](#lighten-and-darken-functions)

`lighten` and `darken` functions work similar to `alpha` function, but instead of adding alpha channel they add white or black color to the color with [color-mix](https://caniuse.com/mdn-css_types_color_color-mix).

Will be transformed to:

## [hover mixin](#hover-mixin)

`hover` mixin can be used to create styles that will be applied on hover.

Will be transformed to:

## [rtl/ltr mixins](#rtlltr-mixins)

`rtl` mixin can be used to create styles that will be applied when `dir="rtl"` is set on parent element (usually `<html />`).

Will be transformed to:

`ltr` mixin works the same way, but for `dir="ltr"`:

Will be transformed to:

## [not-rtl/not-ltr mixins](#not-rtlnot-ltr-mixins)

`not-rtl`/`not-ltr` mixins can be used to create styles that will be applied when the direction is set to the opposite value or not set at all. For example, `not-rtl` styles will be applied when `dir="ltr"` or when `dir` is not set at all.

Will be transformed to:

## [where-\* mixins](#where--mixins)

`where-*` mixins are alternative to `light`, `dark`, `rlt` and `hover` mixins. They work exactly the same, but produced CSS is less specific. These mixins are useful when you want to easily override styles, for example, when you are building a library or extension.

Example of using `where-light` mixin:

Will be transformed to:

## [Custom mixins](#custom-mixins)

You can define custom mixins that are not included in the preset by specifying them in the `mixins` option. To learn about mixins syntax, follow [postcss-mixins documentation](https://github.com/postcss/postcss-mixins#readme).

Example of adding `clearfix` and `circle` mixins:

Then you can use these mixins in your styles:

## [Disable specific features](#disable-specific-features)

You can disable specific features of the preset by setting them to `false`:
