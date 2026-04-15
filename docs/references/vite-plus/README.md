# Vite+ Documentation

> Source: https://viteplus.dev/guide/
> Crawled: 2026-04-04T10:58:04.579Z
> Pages: 25 → 8

## Overview

Vite+ is the unified toolchain and entry point for web development. It manages your runtime, package manager, and frontend toolchain in one place by combining Vite, Vitest, Oxlint, Oxfmt, Rolldown, tsdown, and Vite Task into a single, powerful command-line interface that speeds up and simplifies the entire development workflow.

## Documentation Structure

### Getting Started

- **[Introduction](getting-started/introduction.md)** — Overview of Vite+ and its core commands
- **[Project Setup](getting-started/setup.md)** — Creating projects, migrating existing projects, and installing dependencies
- **[Motivation and Runtime](getting-started/motivation-and-runtime.md)** — Why use Vite+ and how to manage Node.js versions

### Commands

- **[Development Commands](commands/development.md)** — `vp dev`, `vp check`, `vp lint`, `vp fmt`, and `vp test`
- **[Build and Pack](commands/build-and-pack.md)** — `vp build` and `vp pack` for applications and libraries
- **[Task Execution](commands/task-execution.md)** — `vp run`, task caching, and running binaries with `vpx`

### Configuration

- **[Configuration Overview](config/overview.md)** — Unified configuration in `vite.config.ts`

### Advanced Topics

- **[Advanced Topics](guides/advanced-topics.md)** — Upgrading, removing, IDE integration, CI/CD, commit hooks, and troubleshooting

## Key Features

- **Unified Toolchain**: One configuration file, one consistent workflow
- **Fast & Scalable**: Built with Rust-powered tools (Vite, Rolldown, Oxc, Vitest)
- **Enterprise-Ready**: 40× faster builds, 50-100× faster linting, 30× faster formatting
- **Fully Open Source**: MIT license, integrates with existing Vite ecosystem
- **Developer Experience**: Supports pnpm, npm, yarn; auto-selects right package manager

## Quick Start

```bash
# Install vp globally
curl -fsSL https://vite.plus | bash

# Create a new project
vp create

# Install dependencies
vp install

# Start development
vp dev

# Check code quality
vp check

# Run tests
vp test

# Build for production
vp build
```

## Core Commands

| Command      | Purpose                                          |
| ------------ | ------------------------------------------------ |
| `vp create`  | Create new apps, packages, or monorepos          |
| `vp migrate` | Migrate existing Vite projects to Vite+          |
| `vp install` | Install dependencies with right package manager  |
| `vp env`     | Manage Node.js versions globally and per-project |
| `vp dev`     | Start the development server                     |
| `vp check`   | Format, lint, and type-check in one pass         |
| `vp test`    | Run JavaScript tests with Vitest                 |
| `vp build`   | Build apps for production                        |
| `vp pack`    | Build libraries or standalone executables        |
| `vp run`     | Run tasks across workspaces with caching         |
| `vpx`        | Run binaries globally                            |

---

**Source Documentation**: https://viteplus.dev/guide/
