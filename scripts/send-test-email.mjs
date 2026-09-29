#!/usr/bin/env node
// scripts/send-test-email.mjs
//
// The Resend quick-start snippet, wired to this project: it reads
// RESEND_API_KEY from .env.local, sends the "Hello World" message, and prints
// the id Resend assigned to it.
//
// Usage (Command Prompt, from the project root):
//   npm run email:test
//   npm run email:test -- you@example.com      # send somewhere else
//
// The app sends mail through src/lib/resend.js behind POST /api/email; this
// script exists so a fresh key can be proven from the terminal without starting
// the dev server. It parses .env.local itself, the same way
// scripts/verify-backend.mjs does, so no extra dependency is needed.
//
// Exit code 0 when Resend accepts the message, 1 otherwise.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const PLACEHOLDER_KEY = "re_xxxxxxxxx";
const DEFAULT_FROM = "onboarding@resend.dev";
// The recipient from the original snippet.
const DEFAULT_TO = "marvinsarmiento847@gmail.com";

function fail(message) {
  console.error(`send-test-email: ${message}`);
  process.exit(1);
}

function loadEnv() {
  const path = join(process.cwd(), ".env.local");

  let source;
  try {
    source = readFileSync(path, "utf8");
  } catch {
    fail(`.env.local was not found at ${path}.`);
  }

  const values = new Map();
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
    if (match) values.set(match[1], match[2].trim().replace(/^["']|["']$/g, ""));
  }

  return values;
}

const values = loadEnv();

// process.env wins so a CI or deployment can pass the key without a file; the
// .env.local values are the fallback, exactly like the app sees them.
const apiKey = process.env.RESEND_API_KEY?.trim() || values.get("RESEND_API_KEY");
const from = process.env.RESEND_FROM_EMAIL?.trim() || values.get("RESEND_FROM_EMAIL") || DEFAULT_FROM;
const to = process.argv[2] || DEFAULT_TO;

if (!apiKey || apiKey === PLACEHOLDER_KEY) {
  fail(
    `Replace ${PLACEHOLDER_KEY} with your real API key in RESEND_API_KEY inside .env.local (create one at https://resend.com/api-keys).`,
  );
}

if (typeof fetch !== "function") {
  fail("global fetch is missing; Node.js 20 or later is required.");
}

const { Resend } = await import("resend");
const resend = new Resend(apiKey);

const { data, error } = await resend.emails.send({
  from,
  to,
  subject: "Hello World",
  html: "<p>Congrats on sending your <strong>first email</strong>!</p>",
});

if (error) {
  fail(`Resend refused the message: ${error.message} (${error.name}, HTTP ${error.statusCode}).`);
}

if (!data?.id) {
  fail("Resend answered without a message id.");
}

console.log(`send-test-email: Resend accepted the message (id ${data.id}).`);
console.log(`send-test-email: from ${from} to ${to}, subject "Hello World".`);
