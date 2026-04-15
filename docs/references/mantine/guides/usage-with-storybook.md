## Setup Mantine in Storybook

Note that this guide covers only Storybook 10+ integration. If you're using an older version of Storybook, it won't work for you.

## [Add Storybook to your application](#add-storybook-to-your-application)

If you already have Storybook in your application, you can skip this step.

Follow the [Storybook getting started](https://storybook.js.org/docs/react/get-started/install/) guide to add Storybook to your application:

## [Configure addons](#configure-addons)

Install `@storybook/addon-themes` Storybook addon:

Add addons to `.storybook/main.ts`:

## [Theme object](#theme-object)

To share the [theme object](https://mantine.dev/theming/theme-object/) between your application and Storybook, create a `src/theme.ts` (or any other path in your application) file with your theme override:

Then you'll be able to use the same theme both in your application and Storybook:

## [Storybook preview](#storybook-preview)

If the `.storybook/preview.tsx` file doesn't exist, create it and add the following content:

All set! Start Storybook:
