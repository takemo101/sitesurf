# Usage with Emotion

Prior to version 7.0, Mantine used [Emotion](https://emotion.sh/) as a styling solution. It was replaced with [CSS modules](https://mantine.dev/styles/css-modules/) in version 7.0, but you can still use Emotion with Mantine if you prefer it over CSS modules.

Note that the `createStyles` function, `sx` and `styles` props work differently from the same features in [version 6.x](https://v6.mantine.dev/styles/create-styles/). If you are planning to upgrade from version 6.x to 7.x, follow the [migration guide](https://mantine.dev/guides/6x-to-7x/).

The `@mantine/emotion` package is compatible with `@mantine/core` 7.9.0 and higher. Before installing, make sure that you are using the latest version of all `@mantine/*` packages.

## [Caveats and support](#caveats-and-support)

[Emotion](https://emotion.sh/) is a runtime CSS-in-JS library – styles are generated and injected into the DOM at runtime. This approach has some limitations:

- **Limited server-side rendering support** – modern frameworks like Next.js with app router do not fully support Emotion or require additional configuration.
- **Runtime overhead** – styles are generated and injected at runtime, which can lead to performance issues on pages with many components.
- **Additional bundle size** – your bundle will include `@emotion/react` (21.2kB minified), `@mantine/emotion` (~2kb minified) and all styles that you use in your components.

The `@mantine/emotion` package can be used with the following frameworks:

- **Vite** and **CRA** with basic setup
- **Next.js with pages router** with additional setup for server-side rendering provided by the package
- **Next.js with app router** with additional setup for server-side rendering provided by Emotion
- Any other framework that does not require server-side rendering with basic setup

There is no official support (the package can probably be used but it's not tested and documentation is not provided) for:

- **React Router**
- **Gatsby**
- **Redwood**
- Any other framework that has server-side rendering

Note that Emotion is not recommended for new projects. If you are starting a new project with Mantine, consider using [CSS modules](https://mantine.dev/styles/css-modules/) instead.

## [Usage with Vite](#usage-with-vite)

[View example repository with full setup](https://github.com/mantinedev/vite-min-template/tree/emotion)

Install dependencies:

Create `emotion.d.ts` file in `src` directory to add types support for `sx` and `styles` props:

Wrap your application with `MantineEmotionProvider` and add `emotionTransform` to `MantineProvider`:

Done! You can now use `sx`, `styles` props and `createStyles` in your application:

## [Usage with Next.js pages router](#usage-with-nextjs-pages-router)

[View example repository with full setup](https://github.com/mantinedev/next-pages-min-template/tree/emotion)

Install dependencies:

Create `emotion` folder with `cache.ts` and `emotion.d.ts` files.

`cache.ts` file:

`emotion.d.ts` file:

Add the following content to `pages/_document.tsx` file:

Add `MantineEmotionProvider` and `emotionTransform` to `pages/_app.tsx` file:

Done! You can now use `sx`, `styles` props and `createStyles` in your application:

## [Usage with Next.js app router](#usage-with-nextjs-app-router)

[View example repository with full setup](https://github.com/mantinedev/next-app-min-template/tree/emotion)

Install dependencies:

Create `app/emotion.d.ts` file with the following content:

Create `app/EmotionRootStyleRegistry.tsx` file with the following content:

Add `RootStyleRegistry`, `MantineEmotionProvider` and `emotionTransform` to `app/layout.tsx`. It should look something like this:

Done! You can now use `sx`, `styles` props and `createStyles` in your application. Note that `'use client'` is required in most components that use `sx`, `styles` or `createStyles`:

## [sx prop](#sx-prop)

With the setup above you can use `sx` prop in all Mantine components. `sx` prop allows adding styles to the root element of the component. It accepts either a styles object or a function that receives theme, utilities and returns styles object:

### [mergeSx function](#mergesx-function)

You can use the `mergeSx` function to merge multiple `sx` props into one. This can be useful for merging `sx` prop provided to a custom component with its own `sx`, like so:

## [styles prop](#styles-prop)

`styles` prop works similar to `sx` prop, but it allows adding styles to all nested elements of the components that are specified in the Styles API table. `styles` prop accepts either an object of styles objects or a function that receives theme, component props, utilities and returns styles object:

## [styles in theme](#styles-in-theme)

You can add styles to Mantine components with [Styles API](https://mantine.dev/styles/styles-api/) using Emotion with `styles` prop. Note that to avoid types collisions, you should not use `Component.extend` method and just pass component configuration object directly.

## [createStyles](#createstyles)

`createStyles` function accepts a function to generate styles with [Emotion](https://emotion.sh/). The function receives 3 arguments that will be described more detailed in the following demos:

- `theme` – [Mantine theme object](https://mantine.dev/theming/theme-object/)
- `params` – object with additional parameters that can be passed to the function in `useStyles` hook
- `u` - object with utilities to generate selectors

`createStyles` function returns `useStyles` hook that should be called in the component that uses given styles:

createStyles demo

### [Pseudo-classes](#pseudo-classes)

You can add pseudo-classes the same way as in any css-preprocessor like Sass:

### [Styles parameters](#styles-parameters)

You can receive any amount of parameters as second argument of `createStyles` function, latter you will need to pass those parameters as argument to `useStyles` hook:

### [Composition and nested selectors](#composition-and-nested-selectors)

Since `createStyles` produces scoped class names you will need to create a reference to selector in order to get static selector. Use `u.ref` function to assign static selectors:

### [Classes merging (cx function)](#classes-merging-cx-function)

To merge class names use `cx` function, it has the same api as [clsx](https://www.npmjs.com/package/clsx) package.

**!important:** Do not use external libraries like [classnames](https://www.npmjs.com/package/classnames) or [clsx](https://www.npmjs.com/package/clsx) with class names created with `createStyles` function as it will produce styles collisions.

### [Media queries](#media-queries)

You can use nested media queries like in Sass. Within query body you can use `theme.breakpoints` defined with [MantineProvider](https://mantine.dev/theming/mantine-provider/) or just static values:

### [Keyframes](#keyframes)

Keyframes demo

## [Utilities](#utilities)

`sx`, `styles` and `createStyles` callback functions receive `u` object with utilities to generate selectors. `u` object contains the following properties:

All utilities except `ref` can be used as selectors in styles object:
