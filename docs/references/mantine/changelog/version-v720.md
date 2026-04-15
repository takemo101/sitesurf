## [Community templates](#community-templates)

You are welcome to share your GitHub templates with the community. Community templates are featured on the [getting started](https://mantine.dev/getting-started/) page. You can find a guide on how to create and submit a template [here](https://help.mantine.dev/q/submit-template).

Examples of templates that you can submit:

- Next.js pages router + MDX + Mantine blog template
- Next.js app router + Mantine + styled-components template
- Vite + Mantine + Emotion template

## [NumberFormatter component](#numberformatter-component)

New [NumberFormatter](https://mantine.dev/core/number-formatter/) component allows to format numbers with thousands separators, decimal separators, and custom number of decimal places. It supports the same formatting related props as [NumberInput](https://mantine.dev/core/number-input/) component.

$ 1,000,000

## [Form actions](#form-actions)

`@mantine/form` package now exports `createFormActions` function that can be used to [change form state](https://mantine.dev/form/actions/) from anywhere in your application. The mechanism of form actions is similar to [notifications system](https://mantine.dev/x/notifications/), [modals manager](https://mantine.dev/x/modals/) and other similar packages.

To use form actions, set `name` property in [use-form](https://mantine.dev/form/use-form/) settings:

Then call `createFormActions` function with the same form name as specified in `useForm` settings:

After that, you can use `demoFormActions` to change form state from anywhere in your application. For example, after a fetch request or after a user interaction with a component that does not have access to the form state:

## [Table data prop](#table-data-prop)

[Table](https://mantine.dev/core/table/) component now supports `data` prop which can be used to generate table rows from given data:

Some elements from the periodic table
| Element position | Atomic mass | Symbol | Element name |
| --- | --- | --- | --- |
| 6 | 12.011 | C | Carbon |
| 7 | 14.007 | N | Nitrogen |
| 39 | 88.906 | Y | Yttrium |
| 56 | 137.33 | Ba | Barium |
| 58 | 140.12 | Ce | Cerium |

## [Table sticky header](#table-sticky-header)

[Table](https://mantine.dev/core/table/) component now supports `stickyHeader` prop, which can be used to make the table header stick to the top of the table:

| Element position | Element name | Symbol | Atomic mass |
| ---------------- | ------------ | ------ | ----------- | ------------------------------- |
| 6                | Carbon       | C      | 12.011      |
| 7                | Nitrogen     | N      | 14.007      |
| 39               | Yttrium      | Y      | 88.906      |
| 56               | Barium       | Ba     | 137.33      |
| 58               | Cerium       | Ce     | 140.12      | Scroll page to see sticky thead |

## [Usage with Sass](#usage-with-sass)

It is now possible to use Mantine with [Sass](https://sass-lang.com/). You can find documentation on [this page](https://mantine.dev/styles/sass/). Note that it is still required to set up [postcss-preset-mantine](https://mantine.dev/styles/postcss-preset/) in order for all functions to work properly. Sass can be used as a replacement for [CSS modules](https://mantine.dev/styles/css-modules/) – it supports all features that CSS modules support.

You can find examples of Mantine + Sass usage in separate branches of templates:

- [Next.js app router + Sass example](https://github.com/mantinedev/next-app-template/tree/sass)
- [Vite + Sass example](https://github.com/mantinedev/vite-template/tree/sass)

## [Inline loaders](#inline-loaders)

[Loader](https://mantine.dev/core/loader/) component now supports `children` prop. The prop allows overriding the default loader with any React node. It is useful in components that support `loaderProps` ([Button](https://mantine.dev/core/button/), [LoadingOverlay](https://mantine.dev/core/loading-overlay/), [Dropzone](https://mantine.dev/x/dropzone/), etc.) – with `loaderProps.children` you can now display any React node instead of the loader.

## [lightHidden and darkHidden props](#lighthidden-and-darkhidden-props)

All Mantine components now support `lightHidden` and `darkHidden` props that can be used to hide components in a specific color scheme:

## [light-root and dark-root mixins](#light-root-and-dark-root-mixins)

New `light-root` and `dark-root` mixins were added to [postcss-preset-mantine](https://mantine.dev/styles/postcss-preset/). These mixins can be used to add color scheme specific styles to the `:root`/`html` element. Note that to use these mixins, you need to update `postcss-preset-mantine` to `1.9.0` or higher.

## [Documentation updates](#documentation-updates)

- New [Styles overview](https://mantine.dev/styles/styles-overview/) guide
- New [Usage with Sass](https://mantine.dev/styles/sass/) guide
- [Storybook guide](https://mantine.dev/guides/storybook/) was updated to use new [@storybook/addon-styling-webpack](https://storybook.js.org/addons/@storybook/addon-styling-webpack) with separate instructions for Vite and other frameworks
- [CSS modules](https://mantine.dev/styles/css-modules/) guide now includes new section about global class names reference with `:global` selector
- [Getting started](https://mantine.dev/getting-started/#set-up-vs-code) guide now includes new section about setting up VS Code with [PostCSS Language Support](https://marketplace.visualstudio.com/items?itemName=csstools.postcss) and [CSS Variable Autocomplete](https://marketplace.visualstudio.com/items?itemName=vunguyentuan.vscode-css-variables) extensions
- [Popover](https://mantine.dev/core/popover/#nested-popovers) documentation now includes a guide on how to use nested popovers
- [AspectRatio](https://mantine.dev/core/aspect-ratio/) documentation now includes a guide on how to use it in flexbox containers
- Additional [AppShell.Section](https://mantine.dev/core/app-shell/) documentation was added
- 8 new [Checkbox](https://mantine.dev/core/checkbox/) examples and demos were added

## [Other changes](#other-changes)

- [Dropzone](https://mantine.dev/x/dropzone/) now supports `loaderProps` prop to pass props down to the [Loader](https://mantine.dev/core/loader/) component
- [theme.variantColorResolver](https://mantine.dev/theming/colors/#colors-variant-resolver) now supports `hoverColor` prop, which allows controlling `color` property when the component is hovered. New property is supported in [Button](https://mantine.dev/core/button/) and [ActionIcon](https://mantine.dev/core/action-icon/) components.
- [Flex](https://mantine.dev/core/flex/) is now a [polymorphic](https://mantine.dev/guides/polymorphic/) component – it accepts `renderRoot` and `component` props
- [Checkbox](https://mantine.dev/core/checkbox/) root element now has `data-checked` attribute when the checkbox is checked
- [Checkbox](https://mantine.dev/core/checkbox/) and [Radio](https://mantine.dev/core/radio/) components now support changing icon color with `iconColor` prop
- [use-form](https://mantine.dev/form/use-form/) now supports `onValuesChange` option which can be used to sync form values with external state
