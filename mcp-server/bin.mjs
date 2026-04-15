#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const cli = join(__dirname, "cli.ts");

try {
  execFileSync("npx", ["tsx", cli, ...process.argv.slice(2)], { stdio: "inherit" });
} catch (e) {
  process.exit(e.status ?? 1);
}
