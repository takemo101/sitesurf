# Usage with Sass

This guide will explain how to use [Sass](https://sass-lang.com/) in combination with [postcss-preset-mantine](https://mantine.dev/styles/postcss-preset/). Note that the examples on the mantine.dev website use only `postcss-preset-mantine` – you will need to modify them to use with Sass.

## [Sass modules](#sass-modules)

You can use Sass modules the same way as [CSS modules](https://mantine.dev/styles/css-modules/):

- Use `*.module.scss`/`*.module.sass` extension for your files to enable modules
- Use `*.scss`/`*.sass` extension for global styles

## [Usage with Vite](#usage-with-vite)

Install `sass`:

Add Mantine resources in your `vite.config.js` file:

Create the `src/_mantine.scss` file:

All done! you can now use breakpoint variables, `rem` function, `hover`, `light`/`dark` mixins:

## [Usage with Next.js](#usage-with-nextjs)

Install `sass`:

Add mantine resources in your `next.config.mjs` file:

Create `_mantine.scss` file in the root folder of your project:

All done! you can now use breakpoint variables, `rem` function, `hover`, `light`/`dark` mixins:
