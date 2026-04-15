# MantineProvider

`MantineProvider` provides a [theme object](https://mantine.dev/theming/theme-object/) context value, manages color scheme changes, and injects [CSS variables](https://mantine.dev/styles/css-variables/). It must be rendered at the root of your application and should be used only once.

## [Usage](#usage)

## [MantineProvider props](#mantineprovider-props)

`MantineProvider` supports the following props:

### [theme](#theme)

Pass a [theme object](https://mantine.dev/theming/theme-object/) override to the `theme` prop. It will be merged with the default theme and used in all components.

### [colorSchemeManager](#colorschememanager)

`colorSchemeManager` is used to retrieve and set the color scheme value in external storage. By default, `MantineProvider` uses `window.localStorage` to store the color scheme value, but you can pass your own implementation to the `colorSchemeManager` prop. You can learn more about color scheme management in the [color schemes guide](https://mantine.dev/theming/color-schemes/).

### [defaultColorScheme](#defaultcolorscheme)

The `defaultColorScheme` value is used when `colorSchemeManager` cannot retrieve the value from external storage, for example during server-side rendering or when the user hasn't selected a preferred color scheme. Possible values are `light`, `dark`, and `auto`. By default, the color scheme value is `light`. You can learn more about color scheme management in the [color schemes guide](https://mantine.dev/theming/color-schemes/).

### [cssVariablesSelector](#cssvariablesselector)

`cssVariablesSelector` is a CSS selector to which [CSS variables](https://mantine.dev/styles/css-variables/) should be added. By default, variables are applied to `:root` and `:host`. `MantineProvider` generates CSS variables based on given [theme override](https://mantine.dev/theming/theme-object/) and `cssVariablesResolver`, then these variables are rendered into `<style />` tag next to your application. You can learn more about Mantine CSS variables in the [CSS variables guide](https://mantine.dev/styles/css-variables/).

### [withCssVariables](#withcssvariables)

`withCssVariables` determines whether theme CSS variables should be added to the given `cssVariablesSelector`. By default, it is set to `true`. You should not change it unless you want to manage CSS variables via a `.css` file (note that in this case you will need to generate all theme tokens that are not part of the default theme on your side).

### [deduplicateCssVariables](#deduplicatecssvariables)

`deduplicateCssVariables` determines whether CSS variables should be deduplicated: if a CSS variable has the same value as in the default theme, it is not added in the runtime. By default, it is set to `true`. If set to `false`, all Mantine CSS variables will be added in a `<style />` tag even if they have the same value as in the default theme.

### [getRootElement](#getrootelement)

`getRootElement` is a function that returns the root application element (usually `html`) to set the `data-mantine-color-scheme` attribute. The default value is `() => document.documentElement` which means that the `data-mantine-color-scheme` attribute will be added to the `<html />` tag. You can learn more about color scheme management in the [color schemes guide](https://mantine.dev/theming/color-schemes/).

### [classNamesPrefix](#classnamesprefix)

`classNamesPrefix` is a prefix for components' static classes (for example `{selector}-Text-root`). The default value is `mantine` – all components will have a `mantine-` prefix in their **static classes**.

In this case (default `classNamesPrefix`), the [Text](https://mantine.dev/core/text/) component will have the following classes:

- `mantine-focus-auto` – global utility class
- `m-3nrA4eL` – component class, usually a random string; with this class library styles are applied
- `mantine-Text-root` – component static class, part of the [Styles API](https://mantine.dev/styles/styles-api/)

With `classNamesPrefix` you can change only the **static class**:

Now the [Text](https://mantine.dev/core/text/) component will have the following classes:

- `mantine-focus-auto` – `classNamesPrefix` does not impact global utility classes – they are static and **cannot be changed**
- `m-3nrA4eL` – `classNamesPrefix` does not impact library classes – they are static and **cannot be changed**
- `app-Text-root` – component static class has `classNamesPrefix` instead of `mantine`

### [withStaticClasses](#withstaticclasses)

`withStaticClasses` determines whether components should have static classes, for example, `mantine-Button-root`. By default, static classes are enabled. To disable them, set `withStaticClasses` to `false`:

### [withGlobalClasses](#withglobalclasses)

`withGlobalClasses` determines whether global classes should be added with a `<style />` tag. Global classes are required for `hiddenFrom`/`visibleFrom` and `lightHidden`/`darkHidden` props to work. By default, global classes are enabled. To disable them, set `withGlobalClasses` to `false`. Note that disabling global classes may break styles of some components.

### [getStyleNonce](#getstylenonce)

`getStyleNonce` is a function to generate a [nonce](https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/nonce) attribute added to dynamically generated `<style />` tags.

### [cssVariablesResolver](#cssvariablesresolver)

`cssVariablesResolver` is a function to generate CSS variables styles based on the [theme object](https://mantine.dev/theming/theme-object/). You can learn more about Mantine CSS variables in the [CSS variables guide](https://mantine.dev/styles/css-variables/#css-variables-resolver).

### [env](#env)

The `env` prop can be used in a test environment to disable some features that might impact tests and/or make it harder to test components:

- transitions that mount/unmount a child component with delay
- portals that render a child component in a different part of the DOM

To enable the test environment, set `env` to `test`:

Note that `env="test"` is intended to be used in test environments only with [Jest](https://mantine.dev/guides/jest/) or [Vitest](https://mantine.dev/guides/vitest/). Do not use it in development or production environments. It is also not recommended to be used with end-to-end testing tools like [Cypress](https://mantine.dev/guides/cypress/) or [Playwright](https://mantine.dev/guides/playwright/).
