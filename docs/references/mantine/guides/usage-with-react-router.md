## [Generate new application](#generate-new-application)

Follow the [React Router getting started guide](https://reactrouter.com/start/framework/installation) to create a new React Router application:

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

Add styles imports, [MantineProvider](https://mantine.dev/theming/mantine-provider/) and [ColorSchemeScript](https://mantine.dev/theming/color-schemes/) to `app/root.tsx`:

All set! Start the development server:
