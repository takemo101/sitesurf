## [withProps function](#withprops-function)

All Mantine components now have `withProps` static function that can be used to add default props to the component:

## [Avatar initials](#avatar-initials)

[Avatar](https://mantine.dev/core/avatar/) component now supports displaying initials with auto generated color based on the given `name` value. To display initials instead of the default placeholder, set `name` prop to the name of the person, for example, `name="John Doe"`. If the name is set, you can use `color="initials"` to generate color based on the name:

JD

JM

AL

SC

MJ

KK

TS

## [BubbleChart component](#bubblechart-component)

New [BubbleChart](https://mantine.dev/charts/bubble-chart/) component:

## [BarChart waterfall type](#barchart-waterfall-type)

[BarChart](https://mantine.dev/charts/bar-chart/) component now supports `waterfall` type which is useful for visualizing changes in values over time:

Effective tax rate in %

TaxRateForeign inc.Perm. diff.CreditsLoss carryf. Reven. adj.ETR\-7071421

## [LineChart gradient type](#linechart-gradient-type)

[LineChart](https://mantine.dev/charts/line-chart/) component now supports `gradient` type which renders line chart with gradient fill:

## [Right Y axis](#right-y-axis)

[LineChart](https://mantine.dev/charts/line-chart/), [BarChart](https://mantine.dev/charts/bar-chart/) and [AreaChart](https://mantine.dev/charts/area-chart/) components now support `rightYAxis` prop which renders additional Y axis on the right side of the chart:

## [RadarChart legend](#radarchart-legend)

[RadarChart](https://mantine.dev/charts/radar-chart/) component now supports legend:

Sales February

Sales January

ApplesOrangesTomatoesGrapesBananasLemons04080120160

## [TagsInput acceptValueOnBlur](#tagsinput-acceptvalueonblur)

[TagsInput](https://mantine.dev/core/tags-input/) component behavior has been changed. Now By default, if the user types in a value and blurs the input, the value is added to the list. You can change this behavior by setting `acceptValueOnBlur` to `false`. In this case, the value is added only when the user presses `Enter` or clicks on a suggestion.

## [Transition delay](#transition-delay)

[Transition](https://mantine.dev/core/transition/) component now supports `enterDelay` and `exitDelay` props to delay transition start:

## [Documentation updates](#documentation-updates)

- New [segmented progress](https://mantine.dev/core/progress/#example-progress-with-segments) example has been added to `Progress` component documentation
- [Select](https://mantine.dev/core/select/), [TagsInput](https://mantine.dev/core/tags-input/) and [MultiSelect](https://mantine.dev/core/multi-select/) components documentation now includes additional demo on how to change the dropdown width
- New [DatePicker](https://mantine.dev/dates/date-picker/#exclude-dates) example for `excludeDate` prop

## [Other changes](#other-changes)

- [Pagination](https://mantine.dev/core/pagination/) component now supports `hideWithOnePage` prop which hides pagination when there is only one page
- [Spoiler](https://mantine.dev/core/spoiler/) component now supports controlled expanded state with `expanded` and `onExpandedChange` props
- [Burger](https://mantine.dev/core/burger/) component now supports `lineSize` prop to change lines height
- [Calendar](https://mantine.dev/dates/calendar/), [DatePicker](https://mantine.dev/dates/date-picker/) and other similar components now support `highlightToday` prop to highlight today's date
