# Configuration Overview

## Configuring Vite+

Vite+ keeps project configuration in one place: `vite.config.ts`, allowing you to consolidate many top-level configuration files in a single file. You can keep using your Vite configuration such as `server` or `build`, and add Vite+ blocks for the rest of your workflow:

ts

```
import { defineConfig } from 'vite-plus';

export default defineConfig({
 server: {},
 build: {},
 preview: {},

 test: {},
 lint: {},
 fmt: {},
 run: {},
 pack: {},
 staged: {},
});
```

## Vite+ Specific Configuration

Vite+ extends the basic Vite configuration with these additions:

- [`lint`](https://viteplus.dev/config/lint) for Oxlint
- [`fmt`](https://viteplus.dev/config/fmt) for Oxfmt
- [`test`](https://viteplus.dev/config/test) for Vitest
- [`run`](https://viteplus.dev/config/run) for Vite Task
- [`pack`](https://viteplus.dev/config/pack) for tsdown
- [`staged`](https://viteplus.dev/config/staged) for staged-file checks
