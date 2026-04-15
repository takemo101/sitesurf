## Mantine colors generator

Enter base color

Display colors info

Preset

0#ecf4ff

1#dce4f5

2#b9c7e2

3#94a8d0

4#748dc0

5#5f7cb7

6#5474b4

7#44639f

8#3a5890

9#2c4b80

Variants preview

| Filled | Light | Outline | Subtle |
| ------ | ----- | ------- | ------ |
|        |       |         |        |

Colors array

```
[
 "#ecf4ff",
 "#dce4f5",
 "#b9c7e2",
 "#94a8d0",
 "#748dc0",
 "#5f7cb7",
 "#5474b4",
 "#44639f",
 "#3a5890",
 "#2c4b80"
]
```

Usage with MantineProvider

```
import { MantineProvider, createTheme, MantineColorsTuple } from '@mantine/core';

const myColor: MantineColorsTuple = [
 '#ecf4ff',
 '#dce4f5',
 '#b9c7e2',
 '#94a8d0',
 '#748dc0',
 '#5f7cb7',
 '#5474b4',
 '#44639f',
 '#3a5890',
 '#2c4b80'
];

const theme = createTheme({
 colors: {
 myColor,
 }
 primaryColor: 'myColor',
});

function Demo() {
 return (
 <MantineProvider theme={theme}>
 {/* Your app here */}
 </MantineProvider>
 );
}
```
