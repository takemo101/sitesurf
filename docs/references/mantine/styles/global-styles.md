# Global styles

The `@mantine/core` package includes some global styles that are required for components to work correctly. If you override these styles, some components might not work as expected.

Global styles are automatically imported with:

If you want to import styles [per component](https://mantine.dev/styles/css-files-list/), you need to import all global styles manually:

## [CSS reset](#css-reset)

The `@mantine/core` package includes minimal CSS reset – it includes only basic styles required for components to work in modern browsers. If you need to support older browsers, you can additionally include [normalize.css](https://necolas.github.io/normalize.css/) or any other CSS reset of your choice.

## [Body and :root elements styles](#body-and-root-elements-styles)

The `@mantine/core` package includes the following `body` and `:root` element styles:

## [Static classes](#static-classes)

The `@mantine/core` package includes the following static classes:

- `mantine-active` – contains `:active` styles
- `mantine-focus-auto` – contains `:focus-visible` styles
- `mantine-focus-always` – contains `:focus` styles
- `mantine-focus-never` – removes default browser focus ring
- `mantine-visible-from-{breakpoint}` – shows element when screen width is greater than the breakpoint, for example `mantine-visible-from-sm`
- `mantine-hidden-from-{breakpoint}` – hides element when screen width is greater than the breakpoint, for example `mantine-hidden-from-sm`

You can use these classes with any components or elements:

## [Add global styles in your application](#add-global-styles-in-your-application)

It is recommended to use [CSS modules](https://mantine.dev/styles/css-modules/) to apply styles to Mantine components with the `className` prop or with [Styles API](https://mantine.dev/styles/styles-api/). CSS modules file names usually end with `.module.css`. If you want to add global styles to your application, create a file with a `.css` extension but without the `.module` part, for example `global.css`.

In global `.css` files you can reference all Mantine [CSS variables](https://mantine.dev/styles/css-variables/) and change styles of `<body />`, `:root`, and other elements. For example, to change the body background-color:
