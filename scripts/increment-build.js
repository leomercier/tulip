#!/usr/bin/env node
// Increments buildNumber in build-number.json at the monorepo root.
// Called by the git pre-commit hook so every commit gets a new build number.
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, "../build-number.json");

const data = JSON.parse(readFileSync(file, "utf8"));
data.buildNumber++;
writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
console.log(`build number → ${data.buildNumber}`);
