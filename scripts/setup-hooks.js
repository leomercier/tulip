#!/usr/bin/env node
// Installs the pre-commit hook that auto-increments the build number.
// Run via `pnpm prepare` or manually with `node scripts/setup-hooks.js`.
import { writeFileSync, chmodSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const hooksDir = join(__dirname, "../.git/hooks");

if (!existsSync(hooksDir)) {
  console.log("No .git/hooks directory found — skipping hook installation.");
  process.exit(0);
}

const hookPath = join(hooksDir, "pre-commit");
const hookContent = `#!/bin/sh
# Auto-increment build number on every commit.
node "$(git rev-parse --show-toplevel)/scripts/increment-build.js"
git add "$(git rev-parse --show-toplevel)/build-number.json"
`;

writeFileSync(hookPath, hookContent);
chmodSync(hookPath, 0o755);
console.log("pre-commit hook installed at .git/hooks/pre-commit");
