# Getting Started

## Getting Started

Vite+ is the unified toolchain and entry point for web development. It manages your runtime, package manager, and frontend toolchain in one place by combining [Vite](https://vite.dev/), [Vitest](https://vitest.dev/), [Oxlint](https://oxc.rs/docs/guide/usage/linter.html), [Oxfmt](https://oxc.rs/docs/guide/usage/formatter.html), [Rolldown](https://rolldown.rs/), [tsdown](https://tsdown.dev/), and [Vite Task](https://github.com/voidzero-dev/vite-task).

Vite+ ships in two parts: `vp`, the global command-line tool, and `vite-plus`, the local package installed in each project. If you already have a Vite project, use [`vp migrate`](https://viteplus.dev/guide/migrate) to migrate it to Vite+, or paste our [migration prompt](https://viteplus.dev/guide/migrate#migration-prompt) into your coding agent.

## Install `vp`

### macOS / Linux

bash

```
curl -fsSL https://vite.plus | bash
```

### Windows

powershell

```
irm https://vite.plus/ps1 | iex
```

After installation, open a new shell and run:

bash

```
vp help
```

INFO

Vite+ will manage your global Node.js runtime and package manager. If you'd like to opt out of this behavior, run `vp env off`. If you realize Vite+ is not for you, type `vp implode`, but please [share your feedback with us](https://discord.gg/cAnsqHh5PX).

Using a minor platform (CPU architecture, OS) ?

Prebuilt binaries are distributed for the following platforms (grouped by [Node.js v24 platform support tier](https://github.com/nodejs/node/blob/v24.x/BUILDING.md#platform-list)):

- Tier 1
- Linux x64 glibc (`x86_64-unknown-linux-gnu`)
- Linux arm64 glibc (`aarch64-unknown-linux-gnu`)
- Windows x64 (`x86_64-pc-windows-msvc`)
- macOS x64 (`x86_64-apple-darwin`)
- macOS arm64 (`aarch64-apple-darwin`)
- Tier 2
- Windows arm64 (`aarch64-pc-windows-msvc`)
- Experimental
- Linux x64 musl (`x86_64-unknown-linux-musl`)
- Other
- Linux arm64 musl (`aarch64-unknown-linux-musl`)

If a prebuilt binary is not available for your platform, installation will fail with an error.

On Alpine Linux (musl), you need to install `libstdc++` before using Vite+:

sh

```
apk add libstdc++
```

This is required because the managed [unofficial-builds](https://unofficial-builds.nodejs.org/) Node.js runtime depends on the GNU C++ standard library.

## Quick Start

Create a project, install dependencies, and use the default commands:

bash

```
vp create # Create a new project
vp install # Install dependencies
vp dev # Start the dev server
vp check # Format, lint, type-check
vp test # Run JavaScript tests
vp build # Build for production
```

You can also just run `vp` on its own and use the interactive command line.

## Core Commands

Vite+ can handle the entire local frontend development cycle from starting a project, developing it, checking & testing, and building it for production.

### Start

- [`vp create`](https://viteplus.dev/guide/create) creates new apps, packages, and monorepos.
- [`vp migrate`](https://viteplus.dev/guide/migrate) moves existing projects onto Vite+.
- [`vp config`](https://viteplus.dev/guide/commit-hooks) configures commit hooks and agent integration.
- [`vp staged`](https://viteplus.dev/guide/commit-hooks) runs checks on staged files.
- [`vp install`](https://viteplus.dev/guide/install) installs dependencies with the right package manager.
- [`vp env`](https://viteplus.dev/guide/env) manages Node.js versions.

### Develop

- [`vp dev`](https://viteplus.dev/guide/dev) starts the dev server powered by Vite.
- [`vp check`](https://viteplus.dev/guide/check) runs format, lint, and type checks together.
- [`vp lint`](https://viteplus.dev/guide/lint), [`vp fmt`](https://viteplus.dev/guide/fmt), and [`vp test`](https://viteplus.dev/guide/test) let you run those tools directly.

### Execute

- [`vp run`](https://viteplus.dev/guide/run) runs tasks across workspaces with caching.
- [`vp cache`](https://viteplus.dev/guide/cache) clears task cache entries.
- [`vpx`](https://viteplus.dev/guide/vpx) runs binaries globally.
- [`vp exec`](https://viteplus.dev/guide/vpx) runs local project binaries.
- [`vp dlx`](https://viteplus.dev/guide/vpx) runs package binaries without adding them as dependencies.

### Build

- [`vp build`](https://viteplus.dev/guide/build) builds apps.
- [`vp pack`](https://viteplus.dev/guide/pack) builds libraries or standalone artifacts.
- [`vp preview`](https://viteplus.dev/guide/build) previews the production build locally.

### Manage Dependencies

- [`vp add`](https://viteplus.dev/guide/install), [`vp remove`](https://viteplus.dev/guide/install), [`vp update`](https://viteplus.dev/guide/install), [`vp dedupe`](https://viteplus.dev/guide/install), [`vp outdated`](https://viteplus.dev/guide/install), [`vp why`](https://viteplus.dev/guide/install), and [`vp info`](https://viteplus.dev/guide/install) wrap package-manager workflows.
- [`vp pm <command>`](https://viteplus.dev/guide/install) calls other package manager commands directly.

### Maintain

- [`vp upgrade`](https://viteplus.dev/guide/upgrade) updates the `vp` installation itself.
- [`vp implode`](https://viteplus.dev/guide/implode) removes `vp` and related Vite+ data from your machine.

INFO

Vite+ ships with many predefined commands such as `vp build`, `vp test`, and `vp dev`. These commands are built in and cannot be changed. If you want to run a command from your `package.json` scripts, use `vp run <command>`.

[Learn more about `vp run`.](https://viteplus.dev/guide/run)

---

![Vite+ Logo](https://viteplus.dev/icon.svg)

## The UnifiedToolchain for the Web

Manage your runtime, package manager, and frontend stack with one tool.

Free and open source under the MIT license.

Getting started

#### Install vp globally

Install Vite+ once, open a new terminal session, then run `vp help`.

For CI, use [setup-vp](https://github.com/voidzero-dev/setup-vp).

macOS / Linux

curl -fsSL https://vite.plus | bash

Windows (PowerShell)

irm https://vite.plus/ps1 | iex

##### Manages your runtime and package manager

Use `node` automatically, with the right package manager selected for every project.

`pnpm``npm``yarn`

##### Simplifies everyday development

One configuration file and one consistent flow of commands across your whole stack.

`vp env``vp install``vp dev``vp check``vp build``vp run`

##### Powering your favorite frameworks

Supports every framework built on Vite.

\+ 20 more

##### A trusted stack to standardize on

Vite+ is built on established open source industry standards, and maintained by the same experts behind these projects.

![Vite](https://viteplus.dev/assets/vite.FkFFz4VB.png)

![Vite](https://viteplus.dev/assets/vite.FkFFz4VB.png)

69m+

Weekly npm downloads

78.7k

GitHub stars

![Vitest](https://viteplus.dev/assets/vitest.D3fIboCf.png)

![Vitest](https://viteplus.dev/assets/vitest.D3fIboCf.png)

35m+

Weekly npm downloads

16.1k

GitHub stars

![Oxc](https://viteplus.dev/assets/oxc.DAkC6Vtt.png)

![Oxc](https://viteplus.dev/assets/oxc.DAkC6Vtt.png)

5m+

Weekly npm downloads

19.8k

GitHub stars

##### Stay fast at scale

With low-level components written in Rust, Vite+ delivers enterprise-scale performance: up to 40× faster builds than webpack, ~50× to ~100× faster linting than ESLint, and up to 30× faster formatting than Prettier.

##### Focus on shipping, not tooling

- Stop wasting time on tooling maintenance
- Improve cross-team developer mobility
- Standardize best practices for humans and AI-assisted workflows

##### Supply chain security

Vite+ development follows rigorous security practices, and we vet its dependencies across the unified toolchain.

![Vite+ vets all dependencies with rigorous security practices](https://viteplus.dev/assets/productivity-security.CtJu-irT.png)

## Everything you need in one tool

Vite+ unifies your entire web development workflow into a single, powerful command-line interface.

Vite+ dev & build

#### Blazingly fast builds

Spin up dev servers and create production builds with extreme speed. Stay in the flow and keep CI fast.

- Always instant `Hot Module Replacement (HMR)`
- 40× faster production build than webpack
- Opt-in full-bundle dev mode for large apps
- Huge ecosystem of plugins

$ vp build

VITE+ building for production

✓ Transformed 128 modules

dist/index.html0.42 kB

dist/assets/index.css5.1 kB

dist/assets/index.js46.2 kB

✓ Built in 421ms

Vite+ check

#### Format, lint, and type-check in one pass

Keep every repo consistent with one command powered by Oxlint, Oxfmt, and `tsgo`.

- `Prettier` compatible formatting
- 600+ `ESLint` compatible rules
- Type-aware linting and fast type checks with `tsgo`
- `vp check --fix` auto-fixes where possible

$ vp check

pass: All 42 files are correctly formatted (88ms, 16 threads)

pass: Found no warnings, lint errors, or type errors in 42 files(184ms, 16 threads)

Vite+ test

#### Testing made simple

Feature rich test runner that automatically reuses the same resolve and transform config from your application.

- `Jest` compatible API
- Test isolation by default
- Browser Mode: run unit tests in actual browsers
- Coverage reports, snapshot tests, type tests, visual regression tests...

![vp test terminal command](https://viteplus.dev/assets/test.DqwICtpI.svg)

Vite+ run

#### Vite Task for monorepos and scripts

Run built-in commands and `package.json` scripts with automated caching and dependency-aware execution.

- Automated input tracking for cacheable tasks
- Dependency-aware execution across workspace packages
- Familiar script execution via `vp run`

Vite+ pack

#### Library packaging with best practices baked in

Package TS and JS libraries for npm or build standalone app binaries with a single `vp pack` command.

- `DTS` generation & bundling
- Automatic package exports generation
- Standalone app binaries and transform-only unbundled mode

$ vp pack

CLI Building entry: src/index.ts

CLI Using config: tsdown.config.ts

CLI tsdown 0.14.1 powered by Rolldown

ESM dist/index.js4.8 kB

DTS dist/index.d.ts1.2 kB

✓ Pack completed in 128ms

### Fullstack? No problem.

Vite+ can be the foundation of any type of web apps - from SPAs to fullstack meta frameworks.

###### Meta Frameworks

You can use meta-frameworks that ship as Vite plugins with Vite+

![Meta frameworks](https://viteplus.dev/assets/meta-frameworks.DEXTQqKr.png)

###### Platform Agnostic

First-class support on Vercel, Netlify, Cloudflare & more

![Vercel](<data:image/svg+xml,%3csvg%20width='81'%20height='16'%20viewBox='0%200%2081%2016'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20clip-path='url(%23clip0_252_20792)'%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M18.7666%2015.884L9.6333%200L0.5%2015.884H18.7666ZM27.9785%2015.1609L35.6113%200.722004H32.3098L27.0446%2011.208L21.7793%200.722004H18.4778L26.1106%2015.1609H27.9785ZM79.9957%200.722004V15.1609H77.2625V0.722004H79.9957ZM64.7816%209.77172C64.7816%208.64646%2065.0165%207.65673%2065.486%206.8026C65.9558%205.94847%2066.6107%205.2909%2067.4507%204.82996C68.2905%204.36899%2069.2728%204.13852%2070.3975%204.13852C71.394%204.13852%2072.2908%204.35542%2073.088%204.78927C73.8853%205.22312%2074.5185%205.86712%2074.9883%206.72125C75.4581%207.57539%2075.7%208.61933%2075.7144%209.85309V10.4835H67.6643C67.7211%2011.3783%2067.9844%2012.0833%2068.4542%2012.5985C68.9383%2013.1001%2069.5859%2013.351%2070.3975%2013.351C70.9098%2013.351%2071.3796%2013.2154%2071.8066%2012.9442C72.234%2012.6731%2072.5541%2012.307%2072.7676%2011.846L75.565%2012.0494C75.2232%2013.0662%2074.5827%2013.8797%2073.6431%2014.4898C72.7035%2015.0999%2071.6218%2015.4049%2070.3975%2015.4049C69.2728%2015.4049%2068.2905%2015.1745%2067.4507%2014.7135C66.6107%2014.2526%2065.9558%2013.595%2065.486%2012.7409C65.0165%2011.8867%2064.7816%2010.897%2064.7816%209.77172ZM72.8959%208.75489C72.796%207.87364%2072.5187%207.22966%2072.0629%206.82294C71.6075%206.40266%2071.0521%206.1925%2070.3975%206.1925C69.643%206.1925%2069.0309%206.41619%2068.5611%206.8636C68.0913%207.31101%2067.7996%207.94145%2067.6856%208.75489H72.8959ZM60.1704%206.82294C60.6258%207.18898%2060.9105%207.69742%2061.0244%208.34817L63.8432%208.20583C63.7437%207.37879%2063.4516%206.66025%2062.9678%206.05016C62.4836%205.44006%2061.8574%204.9723%2061.0886%204.64693C60.3341%204.30799%2059.5014%204.13852%2058.5902%204.13852C57.4655%204.13852%2056.4835%204.36899%2055.6434%204.82996C54.8034%205.2909%2054.1488%205.94847%2053.679%206.8026C53.2092%207.65673%2052.9743%208.64646%2052.9743%209.77172C52.9743%2010.897%2053.2092%2011.8867%2053.679%2012.7409C54.1488%2013.595%2054.8034%2014.2526%2055.6434%2014.7135C56.4835%2015.1745%2057.4655%2015.4049%2058.5902%2015.4049C59.5298%2015.4049%2060.3839%2015.2355%2061.1527%2014.8965C61.9213%2014.544%2062.5478%2014.0492%2063.0316%2013.412C63.5158%2012.7748%2063.8075%2012.0291%2063.9071%2011.1749L61.0672%2011.0529C60.9676%2011.7715%2060.69%2012.3274%2060.2345%2012.7205C59.7788%2013.1001%2059.2308%2013.29%2058.5902%2013.29C57.7077%2013.29%2057.0244%2012.9849%2056.5403%2012.3748C56.0564%2011.7647%2055.8142%2010.897%2055.8142%209.77172C55.8142%208.64646%2056.0564%207.77876%2056.5403%207.16866C57.0244%206.55857%2057.7077%206.2535%2058.5902%206.2535C59.2024%206.2535%2059.729%206.44331%2060.1704%206.82294ZM46.3049%204.38206H48.8484L48.9218%206.45654C49.1023%205.86932%2049.3534%205.41333%2049.675%205.08853C50.1412%204.61754%2050.7912%204.38206%2051.6248%204.38206H52.6634V6.60243H51.6037C51.0102%206.60243%2050.5227%206.68316%2050.1412%206.84463C49.7737%207.00613%2049.4911%207.2618%2049.2935%207.61167C49.1096%207.96155%2049.018%208.40563%2049.018%208.94388V15.1609H46.3049V4.38206ZM34.573%206.8026C34.1032%207.65673%2033.8683%208.64646%2033.8683%209.77172C33.8683%2010.897%2034.1032%2011.8867%2034.573%2012.7409C35.0428%2013.595%2035.6977%2014.2526%2036.5374%2014.7135C37.3774%2015.1745%2038.3595%2015.4049%2039.4842%2015.4049C40.7085%2015.4049%2041.7905%2015.0999%2042.7301%2014.4898C43.6693%2013.8797%2044.3102%2013.0662%2044.6517%2012.0494L41.8546%2011.846C41.6408%2012.307%2041.3207%2012.6731%2040.8936%2012.9442C40.4666%2013.2154%2039.9968%2013.351%2039.4842%2013.351C38.6729%2013.351%2038.025%2013.1001%2037.5412%2012.5985C37.0714%2012.0833%2036.8081%2011.3783%2036.7509%2010.4835H44.8011V9.85309C44.787%208.61933%2044.5451%207.57539%2044.0753%206.72125C43.6055%205.86712%2042.972%205.22312%2042.1747%204.78927C41.3775%204.35542%2040.4806%204.13852%2039.4842%204.13852C38.3595%204.13852%2037.3774%204.36899%2036.5374%204.82996C35.6977%205.2909%2035.0428%205.94847%2034.573%206.8026ZM41.1499%206.82294C41.6053%207.22966%2041.883%207.87364%2041.9826%208.75489H36.7723C36.8863%207.94145%2037.178%207.31101%2037.6478%206.8636C38.1176%206.41619%2038.7297%206.1925%2039.4842%206.1925C40.1391%206.1925%2040.6941%206.40266%2041.1499%206.82294Z'%20fill='black'/%3e%3c/g%3e%3cdefs%3e%3cclipPath%20id='clip0_252_20792'%3e%3crect%20width='80.0309'%20height='15.884'%20fill='white'%20transform='translate(0.5)'/%3e%3c/clipPath%3e%3c/defs%3e%3c/svg%3e>)

![Netlify](<data:image/svg+xml,%3csvg%20width='77'%20height='32'%20viewBox='0%200%2077%2032'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cg%20clip-path='url(%23clip0_252_20795)'%3e%3cmask%20id='mask0_252_20795'%20style='mask-type:luminance'%20maskUnits='userSpaceOnUse'%20x='0'%20y='0'%20width='77'%20height='31'%3e%3cpath%20d='M76.8051%200.000976562H0.69458V30.9396H76.8051V0.000976562Z'%20fill='white'/%3e%3c/mask%3e%3cg%20mask='url(%23mask0_252_20795)'%3e%3cpath%20d='M18.1516%2030.7781V22.9839L18.3141%2022.8213H19.9378L20.1003%2022.9839V30.7781L19.9378%2030.9407H18.3141L18.1516%2030.7781Z'%20fill='%2308060D'/%3e%3cpath%20d='M18.1516%207.95728V0.163513L18.3141%200.000976562H19.9378L20.1003%200.163513V7.95728L19.9378%208.11982H18.3141L18.1516%207.95728Z'%20fill='%2308060D'/%3e%3cpath%20d='M11.0934%2025.1588H10.8638L9.71582%2024.0103V23.7807L12.3965%2021.1006L13.6121%2021.1012L13.7752%2021.2631V22.4788L11.0934%2025.1588Z'%20fill='%2308060D'/%3e%3cpath%20d='M11.0922%205.78125H10.8626L9.7146%206.92981V7.1594L12.3953%209.83953L13.6109%209.83897L13.774%209.677V8.4614L11.0922%205.78125Z'%20fill='%2308060D'/%3e%3cpath%20d='M0.857116%2014.4971H11.8988L12.0613%2014.6596V16.2832L11.8988%2016.4459H0.857116L0.69458%2016.2832V14.6596L0.857116%2014.4971Z'%20fill='%2308060D'/%3e%3cpath%20d='M66.2506%2014.4971H76.6431L76.8058%2014.6596V16.2832L76.6431%2016.4459H65.6016L65.439%2016.2832L66.088%2014.6596L66.2506%2014.4971Z'%20fill='%2308060D'/%3e%3cpath%20d='M32.2174%2016.1638L32.0549%2016.3264H27.0179L26.8554%2016.4889C26.8554%2016.814%2027.1805%2017.7886%2028.4802%2017.7886C28.9678%2017.7886%2029.4548%2017.6261%2029.6174%2017.301L29.7799%2017.1385H31.7298L31.8923%2017.301C31.7298%2018.2757%2030.9177%2019.7385%2028.4802%2019.7385C25.7182%2019.7385%2024.418%2017.7886%2024.418%2015.5142C24.418%2013.2399%2025.7176%2011.29%2028.3176%2011.29C30.9177%2011.29%2032.2174%2013.2399%2032.2174%2015.5142V16.1644V16.1638ZM29.7799%2014.5391C29.7799%2014.3765%2029.6174%2013.2393%2028.3176%2013.2393C27.0179%2013.2393%2026.8554%2014.3765%2026.8554%2014.5391L27.0179%2014.7016H29.6174L29.7799%2014.5391Z'%20fill='%2308060D'/%3e%3cpath%20d='M36.7667%2017.1385C36.7667%2017.4634%2036.9292%2017.6261%2037.2543%2017.6261H38.7165L38.8791%2017.7886V19.4133L38.7165%2019.576H37.2543C35.792%2019.576%2034.4923%2018.9258%2034.4923%2017.1385V13.5638L34.3297%2013.4013H33.1927L33.03%2013.2387V11.6139L33.1927%2011.4514H34.3297L34.4923%2011.2889V9.8266L34.6548%209.66406H36.6047L36.7672%209.8266V11.2889L36.9298%2011.4514H38.7171L38.8797%2011.6139V13.2387L38.7171%2013.4013H36.9298L36.7672%2013.5638V17.1385H36.7667Z'%20fill='%2308060D'/%3e%3cpath%20d='M42.7783%2019.5748H40.8284L40.6658%2019.4121V8.36371L40.8284%208.20117H42.7783L42.9408%208.36371V19.4121L42.7783%2019.5748Z'%20fill='%2308060D'/%3e%3cpath%20d='M47.165%2010.151H45.2151L45.0525%209.98851V8.36371L45.2151%208.20117H47.165L47.3275%208.36371V9.98851L47.165%2010.151ZM47.165%2019.5748H45.2151L45.0525%2019.4121V11.6133L45.2151%2011.4508H47.165L47.3275%2011.6133V19.4121L47.165%2019.5748Z'%20fill='%2308060D'/%3e%3cpath%20d='M54.8016%208.36371V9.98851L54.6389%2010.151H53.1768C52.8517%2010.151%2052.6891%2010.3136%2052.6891%2010.6386V11.2888L52.8517%2011.4513H54.4765L54.6389%2011.6139V13.2386L54.4765%2013.4012H52.8517L52.6891%2013.5637V19.4127L52.5266%2019.5752H50.5767L50.4142%2019.4127V13.5637L50.2516%2013.4012H49.1145L48.9519%2013.2386V11.6139L49.1145%2011.4513H50.2516L50.4142%2011.2888V10.6386C50.4142%208.85132%2051.7139%208.20117%2053.1762%208.20117H54.6383L54.801%208.36371H54.8016Z'%20fill='%2308060D'/%3e%3cpath%20d='M60.8129%2019.7392C60.1626%2021.364%2059.5132%2022.3387%2057.2382%2022.3387H56.4255L56.263%2022.1761V20.5513L56.4255%2020.3888H57.2382C58.0503%2020.3888%2058.2128%2020.2262%2058.3754%2019.7386V19.5761L55.7759%2013.2395V11.6147L55.9385%2011.4521H57.4007L57.5633%2011.6147L59.5132%2017.1393H59.6756L61.6255%2011.6147L61.788%2011.4521H63.2503L63.4128%2011.6147V13.2395L60.8134%2019.7386L60.8129%2019.7392Z'%20fill='%2308060D'/%3e%3cpath%20d='M20.83%2019.5759L20.6675%2019.4133L20.6686%2014.7055C20.6686%2013.8934%2020.3493%2013.2637%2019.3689%2013.2432C18.8648%2013.2302%2018.288%2013.2421%2017.6719%2013.2682L17.5799%2013.3626L17.5811%2019.4133L17.4184%2019.5759H15.4692L15.3066%2019.4133V11.5275L15.4692%2011.365L19.8559%2011.3252C22.0536%2011.3252%2022.943%2012.8352%2022.943%2014.5395V19.4133L22.7805%2019.5759H20.83Z'%20fill='%2308060D'/%3e%3c/g%3e%3c/g%3e%3cdefs%3e%3cclipPath%20id='clip0_252_20795'%3e%3crect%20width='76.1106'%20height='31.0686'%20fill='white'%20transform='translate(0.69458)'/%3e%3c/clipPath%3e%3c/defs%3e%3c/svg%3e>)

![Cloudflare](https://viteplus.dev/assets/cloudflare.DZ-s4paJ.svg)

![Render](data:image/svg+xml,%3csvg%20viewBox='0%200%20110%2021'%20fill='%2308060D'%20xmlns='http://www.w3.org/2000/svg'%20aria-label='Render'%20%3e%3cpath%20d='M38.1801%203.45902C41.7067%203.45902%2043.9994%205.45905%2043.9994%208.67133C43.9994%2011.0232%2042.6512%2012.7708%2040.5375%2013.5165L44.6811%2020.6218H41.6077L37.7421%2013.8798H33.4728V20.6218H30.8259V3.45902H38.1801ZM33.469%205.84911V11.5165H38.0544C40.1567%2011.5165%2041.2421%2010.3387%2041.2421%208.67133C41.2421%206.96576%2040.1605%205.84911%2038.0544%205.84911H33.469Z'%3e%3c/path%3e%3cpath%20d='M51.4145%208.22773C54.9412%208.22773%2057.2339%2010.8587%2057.2339%2014.1093C57.2339%2014.4878%2057.2073%2014.8817%2057.1349%2015.2718H47.7508C47.865%2017.0921%2049.4151%2018.5223%2051.506%2018.5223C53.0179%2018.5223%2054.2252%2017.876%2055.1316%2016.4496L56.9711%2017.7919C55.8514%2019.8149%2053.6463%2020.878%2051.506%2020.878C47.8536%2020.878%2045.1686%2018.1705%2045.1686%2014.5682C45.1686%2010.9467%2047.7508%208.22773%2051.4145%208.22773ZM54.7013%2013.398C54.5489%2011.6924%2053.1284%2010.4878%2051.3879%2010.4878C49.537%2010.4878%2048.124%2011.6886%2047.8117%2013.398H54.7013Z'%3e%3c/path%3e%3cpath%20d='M59.5495%2020.6218V8.48012H62.0555V10.0098C62.4592%209.39027%2063.6055%208.22773%2065.7725%208.22773C69.0973%208.22773%2070.8492%2010.3004%2070.8492%2013.2488V20.6218H68.3547V13.7804C68.3547%2011.7689%2067.2578%2010.6063%2065.3803%2010.6063C63.5408%2010.6063%2062.044%2011.7689%2062.044%2013.7804V20.6218H59.5495Z'%3e%3c/path%3e%3cpath%20d='M78.9766%208.22773C81.0293%208.22773%2082.389%208.98491%2083.284%2010.136V2.81274H85.7785V20.6218H83.284V18.9659C82.389%2020.117%2081.0293%2020.8742%2078.9766%2020.8742C75.5375%2020.8742%2072.9058%2018.2164%2072.9058%2014.4878C72.9058%2010.7555%2075.5375%208.22773%2078.9766%208.22773ZM75.3966%2014.4878C75.3966%2016.725%2076.9466%2018.6217%2079.2774%2018.6217C81.6082%2018.6217%2083.2687%2016.725%2083.2687%2014.4878C83.2687%2012.2507%2081.593%2010.4801%2079.2774%2010.4801C76.9466%2010.4763%2075.3966%2012.2469%2075.3966%2014.4878Z'%3e%3c/path%3e%3cpath%20d='M94.1382%208.22773C97.6648%208.22773%2099.9575%2010.8587%2099.9575%2014.1093C99.9575%2014.4878%2099.9309%2014.8817%2099.8585%2015.2718H90.4744C90.5886%2017.0921%2092.1387%2018.5223%2094.2295%2018.5223C95.7415%2018.5223%2096.9488%2017.876%2097.8552%2016.4496L99.6947%2017.7919C98.575%2019.8149%2096.3699%2020.878%2094.2295%2020.878C90.5772%2020.878%2087.8922%2018.1705%2087.8922%2014.5682C87.8884%2010.9467%2090.4706%208.22773%2094.1382%208.22773ZM97.4249%2013.398C97.2725%2011.6924%2095.852%2010.4878%2094.1115%2010.4878C92.2606%2010.4878%2090.8476%2011.6886%2090.5353%2013.398H97.4249Z'%3e%3c/path%3e%3cpath%20d='M102.368%2020.6218V8.48012H104.874V10.136C105.556%208.809%20106.702%208.22773%20108.024%208.22773C108.968%208.22773%20109.688%208.52983%20109.688%208.52983L109.425%2010.832C109.288%2010.7823%20108.744%2010.5528%20107.952%2010.5528C106.615%2010.5528%20104.878%2011.2603%20104.878%2014.006V20.6218H102.368Z'%3e%3c/path%3e%3cpath%20d='M15.6491%200.00582604C12.9679%20-0.120371%2010.7133%201.81847%2010.3286%204.373C10.3134%204.49154%2010.2905%204.60627%2010.2715%204.72099C9.67356%207.90268%206.88955%2010.3119%203.5457%2010.3119C2.35364%2010.3119%201.23395%2010.006%200.258977%209.47058C0.140914%209.40557%200%209.4897%200%209.62354V10.3081V20.6218H10.2677V12.8894C10.2677%2011.4668%2011.4178%2010.3119%2012.8346%2010.3119H15.4015C18.3074%2010.3119%2020.6458%207.89121%2020.5315%204.94662C20.4287%202.29649%2018.2884%200.132023%2015.6491%200.00582604Z'%3e%3c/path%3e%3c/svg%3e)

![Nitro icon](data:image/png;base64,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)

###### Deploy anywhere by pairing with Nitro

![Deploy anywhere with Nitro](https://viteplus.dev/assets/nitro.DXLEH_hm.svg)
