# Testing with Jest

This guide will help you set up [Jest](https://jestjs.io/) and [React Testing Library](https://testing-library.com/docs/react-testing-library/intro) for your project. Note that this guide only covers shared logic that can be applied to any framework, and it doesn't cover the initial setup of [Jest](https://jestjs.io/) and [React Testing Library](https://testing-library.com/docs/react-testing-library/intro) as it may vary depending on the framework you're using.

## [Custom render](#custom-render)

All Mantine components require [MantineProvider](https://mantine.dev/theming/mantine-provider/) to be present in the component tree. To add [MantineProvider](https://mantine.dev/theming/mantine-provider/) to the component tree in your tests, create a [custom render](https://testing-library.com/docs/react-testing-library/setup/#custom-render) function:

It's usually more convenient to export all `@testing-library/*` functions that you're planning to use from a `./testing-utils/index.ts` file:

Then you should import all testing utilities from `./testing-utils` instead of `@testing-library/react`:

## [Mock Web APIs](#mock-web-apis)

Most Mantine components depend on browser APIs like `window.matchMedia` or `ResizeObserver`. These APIs aren't available in the `jest-environment-jsdom` environment and you'll need to mock them in your tests.

Create a `jest.setup.js` file in your project root and add the following code to it:

Then add it as a setup file in your `jest.config.js`:

## [Framework specific setup](#framework-specific-setup)

Jest setup for different frameworks may vary and usually changes over time. To learn how to set up Jest for your framework, either check the [Jest](https://jestjs.io/docs/getting-started) and [React Testing Library](https://testing-library.com/docs/react-testing-library/intro) documentation or check one of the premade [templates](https://mantine.dev/getting-started/). Most of the templates include Jest setup, and you can use them as a reference.

## [Testing examples](#testing-examples)

You can find testing examples in Mantine Help Center:

- [How can I test Modal/Drawer/Popover components?](https://help.mantine.dev/q/portals-testing)
- [How can I test Select/MultiSelect components?](https://help.mantine.dev/q/combobox-testing)
