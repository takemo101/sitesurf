# Testing with Vitest

This guide will help you set up [Vitest](https://vitest.dev/) and [React Testing Library](https://testing-library.com/docs/react-testing-library/intro) for your project. Note that this guide is intended for projects that use [Vite](https://vitejs.dev/) as a bundler. If you're using other frameworks/bundlers, we recommend using [Jest](https://mantine.dev/guides/jest/) instead.

## [Installation](#installation)

Install Vitest and React Testing Library:

If you want to run tests from your IDE, install one of the [extensions](https://vitest.dev/guide/ide).

## [Configuration](#configuration)

Add Vitest configuration to your Vite config file:

Then create a `vitest.setup.mjs` file in your project root and add the following code to it:

The code above mocks the `window.matchMedia` and `ResizeObserver` APIs that aren't available in the `jsdom` environment but are required by some Mantine components.

Optionally, you can add Vitest scripts to your `package.json`:

## [Custom render](#custom-render)

All Mantine components require [MantineProvider](https://mantine.dev/theming/mantine-provider/) to be present in the component tree. To add [MantineProvider](https://mantine.dev/theming/mantine-provider/) to the component tree in your tests, create a [custom render](https://testing-library.com/docs/react-testing-library/setup/#custom-render) function:

It's usually more convenient to export all `@testing-library/*` functions that you're planning to use from a `./testing-utils/index.ts` file:

Then you should import all testing utilities from `./testing-utils` instead of `@testing-library/react`:

## [Example of a full setup](#example-of-a-full-setup)

You can find an example with a full Vitest setup in [mantine-vite-template](https://github.com/mantinedev/vite-template).
