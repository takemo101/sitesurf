## [Get started with a template](#templates)

The easiest way to get started is to use one of the templates. All templates are configured correctly: they include [PostCSS setup](https://mantine.dev/styles/postcss-preset/), [ColorSchemeScript](https://mantine.dev/theming/color-schemes/) and other essential features. Some templates also include additional features like [Jest](https://mantine.dev/guides/jest/), [Storybook](https://mantine.dev/guides/storybook/) and ESLint.

If you are not familiar with GitHub, you can find detailed instructions on how to bootstrap a project from a template on [this page](https://help.mantine.dev/q/templates-usage).

## [Generate new application](#generate-new-application)

Follow the [Gatsby quick start](https://www.gatsbyjs.com/docs/quick-start/) guide to create a new Gatsby application:

When asked "Would you like to install a styling system?", select `PostCSS`.

## [Installation](#installation)

Choose packages that you will use in your application:

|     | Package          | Description |
| --- | ---------------- | ----------- |
|     | `@mantine/hooks` |

Hooks for state and UI management

|
| | `@mantine/core` |

Core components library: inputs, buttons, overlays, etc.

|
| | `@mantine/form` |

Form management library

|
| | `@mantine/dates` |

Date inputs, calendars

|
| | `@mantine/charts` |

Recharts based charts library

|
| | `@mantine/notifications` |

Notifications system

|
| | `@mantine/code-highlight` |

Code highlight with your theme colors and styles

|
| | `@mantine/tiptap` |

Rich text editor based on Tiptap

|
| | `@mantine/dropzone` |

Capture files with drag and drop

|
| | `@mantine/carousel` |

Embla based carousel component

|
| | `@mantine/spotlight` |

Overlay command center

|
| | `@mantine/modals` |

Centralized modals manager

|
| | `@mantine/nprogress` |

Navigation progress

|

Install dependencies:

## [PostCSS setup](#postcss-setup)

Install PostCSS plugins and [postcss-preset-mantine](https://mantine.dev/styles/postcss-preset/):

Create a `postcss.config.cjs` file at the root of your application with the following content:

## [Setup](#setup)

Create a `src/theme.ts` file with your theme override:

Create a `gatsby-ssr.tsx` file with the following content:

Create a `gatsby-browser.tsx` file with the following content:

All set! Start the development server:

## [CSS modules](#css-modules)

By default, Gatsby has different syntax for importing CSS modules:
