#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function usage() {
  console.error("Usage: node scripts/env-to-gcloud-yaml.mjs <path-to-.env>");
  process.exit(1);
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseEnv(contents) {
  const pairs = [];
  const lines = contents.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    if (key.startsWith("export ")) {
      const exportKey = key.slice("export ".length).trim();
      if (!exportKey) continue;
      value = unquote(value);
      pairs.push([exportKey, value]);
      continue;
    }

    value = unquote(value);
    pairs.push([key, value]);
  }

  return pairs;
}

function quoteYamlSingle(value) {
  // YAML single-quote escaping: ' => ''
  return `'${value.replace(/'/g, "''")}'`;
}

const filePath = process.argv[2];
if (!filePath) usage();

const abs = path.resolve(process.cwd(), filePath);
if (!fs.existsSync(abs)) {
  console.error(`File not found: ${abs}`);
  process.exit(1);
}

const contents = fs.readFileSync(abs, "utf8");
const vars = parseEnv(contents);

if (vars.length === 0) {
  console.error("No env vars found.");
  process.exit(1);
}

console.log("env:");
for (const [name, value] of vars) {
  console.log(`- name: ${name}`);
  console.log(`  value: ${quoteYamlSingle(value)}`);
}
