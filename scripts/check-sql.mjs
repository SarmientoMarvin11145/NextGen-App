#!/usr/bin/env node
// scripts/check-sql.mjs
//
// Structural smoke test for the Supabase migrations. There is no Postgres in
// this environment, so the script cannot type check SQL, but it does catch the
// mistakes that actually happen when a migration is edited by hand:
//
//   * a string, comment, or dollar-quoted body that is never closed
//   * unbalanced parentheses or a missing statement terminator
//   * a leftover placeholder marker
//
// Usage:
//   node scripts/check-sql.mjs supabase/migrations
//
// Exit code 0 when every file is structurally sound, 1 otherwise.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, extname, relative, sep } from "node:path";

const PLACEHOLDER = /\([^)\n]*follow\)|<!--|TODO|FIXME/i;

// Blanks out comments, strings, identifiers, and dollar-quoted bodies so the
// remaining text is only the structural skeleton of the file. Line positions are
// preserved, so every index in the result still maps to the original line.
function stripSql(source) {
  const code = source.split("");
  const errors = [];
  const lineOf = (index) => source.slice(0, index).split("\n").length;

  let index = 0;
  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];

    // line comment
    if (character === "-" && next === "-") {
      while (index < source.length && source[index] !== "\n") {
        code[index] = " ";
        index += 1;
      }
      continue;
    }

    // block comment
    if (character === "/" && next === "*") {
      const start = index;
      code[index] = " ";
      code[index + 1] = " ";
      index += 2;
      let closed = false;
      while (index < source.length) {
        if (source[index] === "*" && source[index + 1] === "/") {
          code[index] = " ";
          code[index + 1] = " ";
          index += 2;
          closed = true;
          break;
        }
        if (source[index] !== "\n") code[index] = " ";
        index += 1;
      }
      if (!closed) errors.push(`line ${lineOf(start)}: block comment is never closed`);
      continue;
    }

    // dollar quoted body ($$ ... $$, $tag$ ... $tag$)
    if (character === "$") {
      const tag = /^\$[A-Za-z_]*\$/.exec(source.slice(index));
      if (tag) {
        const marker = tag[0];
        const start = index;
        const end = source.indexOf(marker, index + marker.length);
        if (end === -1) {
          errors.push(`line ${lineOf(start)}: dollar quote ${marker} is never closed`);
          index += marker.length;
          continue;
        }
        for (let cursor = index; cursor < end + marker.length; cursor += 1) {
          if (source[cursor] !== "\n") code[cursor] = " ";
        }
        index = end + marker.length;
        continue;
      }
    }

    // single quoted string ('it''s')
    if (character === "'") {
      const start = index;
      code[index] = " ";
      index += 1;
      let closed = false;
      while (index < source.length) {
        if (source[index] === "'" && source[index + 1] === "'") {
          code[index] = " ";
          code[index + 1] = " ";
          index += 2;
          continue;
        }
        if (source[index] === "'") {
          code[index] = " ";
          index += 1;
          closed = true;
          break;
        }
        if (source[index] !== "\n") code[index] = " ";
        index += 1;
      }
      if (!closed) errors.push(`line ${lineOf(start)}: string literal is never closed`);
      continue;
    }

    // double quoted identifier ("name")
    if (character === '"') {
      const start = index;
      code[index] = " ";
      index += 1;
      let closed = false;
      while (index < source.length) {
        if (source[index] === '"') {
          code[index] = " ";
          index += 1;
          closed = true;
          break;
        }
        if (source[index] !== "\n") code[index] = " ";
        index += 1;
      }
      if (!closed) errors.push(`line ${lineOf(start)}: quoted identifier is never closed`);
      continue;
    }

    index += 1;
  }

  return { code: code.join(""), errors, lineOf };
}

function checkBalance(code, lineOf) {
  const errors = [];
  const stack = [];

  for (let index = 0; index < code.length; index += 1) {
    const character = code[index];
    if (character === "(") stack.push(index);
    if (character === ")") {
      if (stack.length === 0) {
        errors.push(`line ${lineOf(index)}: closing parenthesis without an opening one`);
      } else {
        stack.pop();
      }
    }
  }

  for (const open of stack) {
    errors.push(`line ${lineOf(open)}: opening parenthesis is never closed`);
  }

  return errors;
}

function countStatements(code) {
  let depth = 0;
  let statements = 0;

  for (const character of code) {
    if (character === "(") depth += 1;
    else if (character === ")") depth = Math.max(0, depth - 1);
    else if (character === ";" && depth === 0) statements += 1;
  }

  return statements;
}

const roots = process.argv.slice(2);
if (roots.length === 0) {
  console.error("check-sql: pass at least one directory or file (e.g. supabase/migrations).");
  process.exit(1);
}

const files = [];
for (const root of roots) {
  const absolute = resolve(root);
  const stats = statSync(absolute);
  if (stats.isDirectory()) {
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      if (entry.isFile() && extname(entry.name) === ".sql") files.push(join(absolute, entry.name));
    }
  } else {
    files.push(absolute);
  }
}

const failures = [];
let statements = 0;

for (const file of files.sort()) {
  const label = relative(process.cwd(), file).split(sep).join("/");
  const source = readFileSync(file, "utf8");
  const { code, errors, lineOf } = stripSql(source);

  const problems = [...errors, ...checkBalance(code, lineOf)];

  const placeholder = PLACEHOLDER.exec(source);
  if (placeholder) {
    problems.push(`line ${lineOf(placeholder.index)}: placeholder marker "${placeholder[0]}"`);
  }

  const total = countStatements(code);
  if (total === 0) problems.push("no statement terminator found");

  statements += total;
  if (problems.length > 0) failures.push({ file: label, problems });
}

if (failures.length > 0) {
  console.error(`check-sql: ${failures.length} of ${files.length} file(s) look broken.\n`);
  for (const failure of failures) {
    console.error(`  ${failure.file}`);
    for (const problem of failure.problems) console.error(`    ${problem}`);
  }
  process.exit(1);
}

console.log(`check-sql: ${files.length} file(s), ${statements} statement(s) look structurally sound.`);
