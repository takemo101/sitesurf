## [DonutChart component](#donutchart-component)

New [DonutChart](https://mantine.dev/charts/donut-chart/) component:

## [PieChart component](#piechart-component)

New [PieChart](https://mantine.dev/charts/pie-chart/) component:

## [@mantine/dates value formatter](#mantinedates-value-formatter)

[DatePickerInput](https://mantine.dev/dates/date-picker-input/), [MonthPickerInput](https://mantine.dev/dates/month-picker-input/) and [YearPickerInput](https://mantine.dev/dates/year-picker-input/) now support `valueFormatter` prop.

`valueFormatter` is a more powerful alternative to `valueFormat` prop. It allows formatting value label with a custom function. The function is the same for all component types (`default`, `multiple` and `range`) – you need to perform additional checks inside the function to handle different types.

Example of using a custom formatter function with `type="multiple"`:

Pick 2 dates or more

## [@mantine/dates consistent weeks](#mantinedates-consistent-weeks)

You can now force each month to have 6 weeks by setting `consistentWeeks: true` on [DatesProvider](https://mantine.dev/dates/getting-started/). This is useful if you want to avoid layout shifts when month changes.

| Mo  | Tu  | We  | Th  | Fr  | Sa  | Su  |
| --- | --- | --- | --- | --- | --- | --- |
|     |     |     |     |     |     |     |
|     |     |     |     |     |     |     |
|     |     |     |     |     |     |     |
|     |     |     |     |     |     |     |
|     |     |     |     |     |     |     |
|     |     |     |     |     |     |     |

## [Charts series label](#charts-series-label)

It is now possible to change series labels with `label` property in `series` object. This feature is supported in [AreaChart](https://mantine.dev/charts/area-chart/), [BarChart](https://mantine.dev/charts/bar-chart/) and [LineChart](https://mantine.dev/charts/line-chart/) components.

Apples sales

Oranges sales

Tomatoes sales

Mar 22Mar 23Mar 24Mar 25Mar 26025005000750010000

## [Charts value formatter](#charts-value-formatter)

All `@mantine/charts` components now support `valueFormatter` prop, which allows formatting value that is displayed on the y axis and inside the tooltip.

## [Headings text wrap](#headings-text-wrap)

New [Title](https://mantine.dev/core/title/) `textWrap` prop sets [text-wrap](https://developer.mozilla.org/en-US/docs/Web/CSS/text-wrap) CSS property. It controls how text inside an element is wrapped.

### Lorem, ipsum dolor sit amet consectetur adipisicing elit. Quasi voluptatibus inventore iusto cum dolore molestiae perspiciatis! Totam repudiandae impedit maxime!

Text wrap

Wrap

Balance

You can also set `textWrap` on [theme](https://mantine.dev/theming/theme-object/):

If set on theme, `textWrap` is also applied to headings in [Typography](https://mantine.dev/core/typography/)

## [mod prop](#mod-prop)

All components now support `mod` prop, which allows adding data attributes to the root element:

## [Documentation updates](#documentation-updates)

- New [testing with Vitest guide](https://mantine.dev/guides/vitest/)
- [NativeSelect](https://mantine.dev/core/native-select/#with-dividers) with dividers demo
- [Popover](https://mantine.dev/core/popover/#middlewares) `shift` and `flip` middlewares documentation
- [Combobox](https://mantine.dev/core/combobox/#popover-props) props related to [Popover](https://mantine.dev/core/popover/) documentation
- [Loading styles from CDN guide](https://mantine.dev/styles/mantine-styles/#loading-styles-from-cdn)
- [Anchor](https://mantine.dev/core/anchor/#text-props) now includes additional documentation on how to use [Text](https://mantine.dev/core/text/) props
- [Pagination](https://mantine.dev/core/pagination/) now includes props tables for all compound components
- A more detailed breakdown of [browser support](https://mantine.dev/about/#browser-support) has been added to the about page

## [Help center updates](#help-center-updates)

New articles added to the [help center](https://help.mantine.dev/):

- [Can I use Mantine with Astro?](https://help.mantine.dev/q/can-i-use-mantine-with-astro)
- [How can I contribute to the library?](https://help.mantine.dev/q/how-can-i-contribute)
- [How can I add dynamic CSS styles?](https://help.mantine.dev/q/dynamic-css-styles)
- [How can I load fonts in Next.js?](https://help.mantine.dev/q/next-load-fonts)
- [How can I load fonts in Vite?](https://help.mantine.dev/q/vite-load-fonts)
- [Is there a floating action button component?](https://help.mantine.dev/q/floating-action-button)
- [How to change inputs placeholder color?](https://help.mantine.dev/q/inputs-placeholder-color)
- [I do not have styles in my dates components...](https://help.mantine.dev/q/dates-missing-styles)

## [Other changes](#other-changes)

- [Checkbox.Group](https://mantine.dev/core/checkbox/), [Radio.Group](https://mantine.dev/core/radio/) and [Switch.Group](https://mantine.dev/core/switch/) now support `readOnly` prop
- [ActionIcon](https://mantine.dev/core/action-icon/) now has `loading` state animation
- [SegmentedControl](https://mantine.dev/core/segmented-control/) now supports `withItemsBorder` prop which allows removing border between items
- [Progress](https://mantine.dev/core/progress/) now supports `transitionDuration` prop which controls section width animation duration
- [Textarea](https://mantine.dev/core/textarea/) and [JsonInput](https://mantine.dev/core/json-input/) components now support `resize` prop, which allows setting `resize` CSS property on the input
- `@mantine/hooks` package now exports [readLocalStorageValue and readSessionStorageValue](https://mantine.dev/hooks/use-local-storage/#read-storage-value) function to get value from storage outside of React components
