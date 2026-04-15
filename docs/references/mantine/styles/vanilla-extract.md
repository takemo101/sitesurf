## Vanilla extract integration

[Vanilla extract](https://vanilla-extract.style/) is a TypeScript CSS preprocessor that generates static CSS files at build time. It is a great alternative to [CSS Modules](https://mantine.dev/styles/css-modules/) if you prefer to write your styles in TypeScript.

## [Vanilla extract vs CSS Modules](#vanilla-extract-vs-css-modules)

[Vanilla extract](https://vanilla-extract.style/) and [CSS Modules](https://mantine.dev/styles/css-modules/) do the same thing, but with different syntax. Common features of [Vanilla extract](https://vanilla-extract.style/) and [CSS Modules](https://mantine.dev/styles/css-modules/):

- Styles are generated at build time – no runtime and performance overhead
- Class names are scoped to the styles file

Differences between [Vanilla extract](https://vanilla-extract.style/) and [CSS Modules](https://mantine.dev/styles/css-modules/):

- Vanilla extract styles are type-safe
- You can use any JavaScript/TypeScript code in Vanilla extract styles, including [color functions](https://mantine.dev/styles/color-functions/)
- With Vanilla extract you do not have access to [postcss-preset-mantine](https://mantine.dev/styles/postcss-preset/) features like the `light-dark` function and `hover` mixin. Because of this, you will not be able to copy-paste all demos from the Mantine documentation and use them with Vanilla extract.
- Vanilla extract requires additional configuration and setup that may not be available for your build tool/framework. Most popular tools like [Next.js](https://nextjs.org/) and [Vite](https://vitejs.dev/) have plugins for Vanilla extract, but if you are using something more niche, you might need to configure it yourself.

Note that you can use both [Vanilla extract](https://vanilla-extract.style/) and [CSS Modules](https://mantine.dev/styles/css-modules/) in the same project; it will not cause any issues: performance will be the same and the bundle size will not be impacted.

## [Installation](#installation)

Follow the [installation instructions](https://vanilla-extract.style/documentation/getting-started) to install Vanilla extract. Then install the `@mantine/vanilla-extract` package; it exports the `themeToVars` function to convert the Mantine theme to CSS variables:

## [Templates](#templates)

You can use one of the following templates to get started or as a reference for your own setup. Note that all templates include only minimal setup.

<table><tbody><tr data-with-row-border="true" data-hover="true"><td></td><td><p>next-vanilla-extract-template</p><p>Next.js template with Vanilla extract example</p></td><td><a data-variant="default" data-size="xs" data-with-right-section="true" href="https://github.com/mantinedev/next-vanilla-extract-template" target="_blank"><span><span>Use template</span><span data-position="right"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 256 256"><path d="M224,104a8,8,0,0,1-16,0V59.32l-66.33,66.34a8,8,0,0,1-11.32-11.32L196.68,48H152a8,8,0,0,1,0-16h64a8,8,0,0,1,8,8Zm-40,24a8,8,0,0,0-8,8v72H48V80h72a8,8,0,0,0,0-16H48A16,16,0,0,0,32,80V208a16,16,0,0,0,16,16H176a16,16,0,0,0,16-16V136A8,8,0,0,0,184,128Z"></path></svg></span></span></a></td></tr><tr data-with-row-border="true" data-hover="true"><td></td><td><p>vite-vanilla-extract-template</p><p>Vite template with Vanilla extract example</p></td><td><a data-variant="default" data-size="xs" data-with-right-section="true" href="https://github.com/mantinedev/vite-vanilla-extract-template" target="_blank"><span><span>Use template</span><span data-position="right"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 256 256"><path d="M224,104a8,8,0,0,1-16,0V59.32l-66.33,66.34a8,8,0,0,1-11.32-11.32L196.68,48H152a8,8,0,0,1,0-16h64a8,8,0,0,1,8,8Zm-40,24a8,8,0,0,0-8,8v72H48V80h72a8,8,0,0,0,0-16H48A16,16,0,0,0,32,80V208a16,16,0,0,0,16,16H176a16,16,0,0,0,16-16V136A8,8,0,0,0,184,128Z"></path></svg></span></span></a></td></tr></tbody></table>

## [Theming](#theming)

Vanilla extract provides [createTheme](https://vanilla-extract.style/documentation/theming/) function which converts given theme object into CSS variables and assigns them to `:root` or other selector. You should not use Vanilla extract `createTheme` to generate Mantine theme tokens – all Mantine [theme](https://mantine.dev/theming/theme-object/) properties are already exposed as CSS variables. Instead, use `themeToVars` function from `@mantine/vanilla-extract` package to create an object with CSS variables from Mantine theme:

## [Styling](#styling)

Import `vars` object in `*.css.ts` files to access Mantine [CSS variables](https://mantine.dev/styles/css-variables/):

## [rem and em](#rem-and-em)

To convert px to [rem or em](https://mantine.dev/styles/rem/) use `rem` and `em` functions from `@mantine/core` package:

## [light and dark selectors](#light-and-dark-selectors)

`vars` object contains `lightSelector` and `darkSelector` properties which can be used to apply styles only in light or dark color scheme:

Note that usually it is more convenient to use only one of them: apply styles for light color scheme and then override them for dark color scheme with `vars.darkSelector` (or vice versa):

## [largerThan and smallerThan](#largerthan-and-smallerthan)

`vars` object contains `largerThan` and `smallerThan` properties which can be used in `@media` as a shorthand for `min-width` and `max-width`:

## [rtl selector](#rtl-selector)

Use `vars.rtlSelector` to apply styles only in rtl direction:
