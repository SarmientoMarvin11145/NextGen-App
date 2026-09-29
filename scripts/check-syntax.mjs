#!/usr/bin/env node
// scripts/check-syntax.mjs
//
// Fast syntax gate for the whole repository. It parses every JavaScript,
// JSX, TypeScript, and TSX file with the same SWC parser the Next.js build
// uses, so a broken import path, an unclosed tag, or a stray brace is caught in
// a couple of seconds instead of halfway through `next build`.
//
// Usage:
//   node scripts/check-syntax.mjs                 # checks src/ by default
//   node scripts/check-syntax.mjs src supabase/functions
//
// Exit code 0 when every file parses, 1 otherwise.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, extname, relative, sep } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { transformSync } = require("next/dist/build/swc");

const EXCLUDED_DIRECTORIES = new Set([
  ".next",
  ".git",
  "node_modules",
  "public",
  "dist",
  "build",
  "coverage",
  "out",
]);

const EXTENSIONS = new Map([
  [".js", { syntax: "ecmascript", jsx: true }],
  [".mjs", { syntax: "ecmascript", jsx: true }],
  [".cjs", { syntax: "ecmascript", jsx: false }],
  [".jsx", { syntax: "ecmascript", jsx: true }],
  [".ts", { syntax: "typescript", jsx: false }],
  [".tsx", { syntax: "typescript", jsx: true }],
]);

const targets = process.argv.slice(2);
const roots = targets.length > 0 ? targets : ["src"];

function collectFiles(directory, collected) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRECTORIES.has(entry.name)) continue;
      collectFiles(join(directory, entry.name), collected);
      continue;
    }

    if (!entry.isFile()) continue;
    if (EXTENSIONS.has(extname(entry.name))) collected.push(join(directory, entry.name));
  }

  return collected;
}

function parserOptionsFor(filename) {
  const { syntax, jsx } = EXTENSIONS.get(extname(filename));
  return {
    syntax,
    jsx,
    decorators: false,
    dynamicImport: true,
  };
}

const failures = [];
let checked = 0;

for (const root of roots) {
  const absoluteRoot = resolve(root);

  let stats;
  try {
    stats = statSync(absoluteRoot);
  } catch {
    failures.push({ file: root, message: `${root} does not exist.` });
    continue;
  }

  const files = stats.isDirectory() ? collectFiles(absoluteRoot, []) : [absoluteRoot];

  for (const file of files) {
    const label = relative(process.cwd(), file).split(sep).join("/");
    const source = readFileSync(file, "utf8");
    checked += 1;

    try {
      transformSync(source, {
        filename: file,
        isModule: true,
        sourceMaps: false,
        jsc: {
          parser: parserOptionsFor(file),
          target: "esnext",
          loose: false,
        },
      });
    } catch (error) {
      const message = String(error?.message || error).split("\n")[0];
      failures.push({ file: label, message });
    }
  }
}

if (failures.length > 0) {
  console.error(`check-syntax: ${failures.length} of ${checked} file(s) failed to parse.\n`);
  for (const failure of failures) {
    console.error(`  ${failure.file}\n    ${failure.message}`);
  }
  process.exit(1);
}

console.log(`check-syntax: ${checked} file(s) parsed cleanly.`);
