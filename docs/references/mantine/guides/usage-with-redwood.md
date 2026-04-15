## Usage with RedwoodJS

## [Get started with a template](#templates)

The easiest way to get started is to use one of the templates. All templates are configured correctly: they include [PostCSS setup](https://mantine.dev/styles/postcss-preset/), [ColorSchemeScript](https://mantine.dev/theming/color-schemes/) and other essential features. Some templates also include additional features like [Jest](https://mantine.dev/guides/jest/), [Storybook](https://mantine.dev/guides/storybook/) and ESLint.

If you are not familiar with GitHub, you can find detailed instructions on how to bootstrap a project from a template on [this page](https://help.mantine.dev/q/templates-usage).

<table><tbody><tr data-with-row-border="true" data-hover="true"><td></td><td><p>redwood-template</p><p>RedwoodJS template with basic setup</p></td><td><a data-variant="default" data-size="xs" data-with-right-section="true" href="https://github.com/mantinedev/redwood-template" target="_blank"><span><span>Use template</span><span data-position="right"><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" fill="currentColor" viewBox="0 0 256 256"><path d="M224,104a8,8,0,0,1-16,0V59.32l-66.33,66.34a8,8,0,0,1-11.32-11.32L196.68,48H152a8,8,0,0,1,0-16h64a8,8,0,0,1,8,8Zm-40,24a8,8,0,0,0-8,8v72H48V80h72a8,8,0,0,0,0-16H48A16,16,0,0,0,32,80V208a16,16,0,0,0,16,16H176a16,16,0,0,0,16-16V136A8,8,0,0,0,184,128Z"></path></svg></span></span></a></td></tr></tbody></table>

## [Generate new application](#generate-new-application)

Follow the [Redwood getting started guide](https://redwoodjs.com/docs/quick-start) to create a new Redwood application:

## [Installation](#installation)

**Note that it's recommended to use `yarn` instead of `npm` to install dependencies.**

Open the `web` directory before installing dependencies:

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

Create a `postcss.config.js` file in the `web` directory with the following content:

## [Setup](#setup)

Add styles imports, [MantineProvider](https://mantine.dev/theming/mantine-provider/) and [ColorSchemeScript](https://mantine.dev/theming/color-schemes/) to the `web/src/App.tsx` file:

All set! Start the development server:
