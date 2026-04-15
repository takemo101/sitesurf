## [Is it possible to use Mantine with JavaScript?](#is-it-possible-to-use-mantine-with-javascript)

Yes, it's possible to use all `@mantine/*` packages (as well as all other npm packages) with JavaScript. `@mantine/*` packages are written in TypeScript and have type definitions, so you'll get some benefits of TypeScript (like autocompletion in your IDE) when using them with JavaScript.

## [Transforming demos code to JavaScript](#transforming-demos-code-to-javascript)

All demos in Mantine documentation are written in TypeScript. In most cases, there's no difference between TypeScript and JavaScript code – you don't have to do anything.

To transform TypeScript code to JavaScript, you can use the [TypeScript playground](https://www.typescriptlang.org/play?jsx=1&preserveValueImports=false#code/Q) – paste the demo code into the playground and all types will be removed. Note that you'll also need to remove type imports from the code.

Example of transformed code:

## [Should Mantine be used with JavaScript?](#should-mantine-be-used-with-javascript)

We recommend using Mantine with TypeScript. It doesn't require deep knowledge of TypeScript and will make your code more robust and easier to maintain. For example, you'll get type errors when you pass invalid props to components or when you use non-existent props. TypeScript will also help you during migration to new versions of Mantine – you'll get type errors when props/components that you have in your code are removed/renamed/changed.

If you're not familiar with TypeScript yet, using Mantine with TypeScript will be a great opportunity to learn it. You can use any of the [templates](https://mantine.dev/getting-started/) to get started – all of them include TypeScript support out of the box.
