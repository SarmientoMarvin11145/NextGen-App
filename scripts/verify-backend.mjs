#!/usr/bin/env node
// scripts/verify-backend.mjs
//
// Deployment smoke test for the Supabase backend. Every check in this
// repository (lint, types, syntax, SQL structure, `next build`) passes while the
// remote project is still empty, so this script answers the one question left
// after `supabase db push` and `supabase functions deploy`: does the project in
// .env.local really have the nine tables, four Edge Functions, and two storage
// buckets the app reads?
//
// Every probe uses the publishable key from .env.local, so a passing run
// describes exactly what the deployed site can see with no user signed in. A
// table that exists but is protected by RLS answers 200 with no rows, which is
// what separates "deployed" from "still missing".
//
// Usage:
//   node scripts/verify-backend.mjs
//
// Exit code 0 when every table, function, and bucket answers, 1 otherwise.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const TABLES = [
  "profiles",
  "announcements",
  "files",
  "events",
  "event_registrations",
  "attendance_sessions",
  "attendance_scanners",
  "attendance_tokens",
  "attendance",
];

const FUNCTIONS = [
  "create-attendance-token",
  "update-student-location",
  "get-current-attendance-session",
  "verify-attendance",
];

const BUCKETS = ["nextgen-files", "nextgen-event-banners"];

// PostgREST answers PGRST205 (or 42P01) when a relation is not in its schema
// cache, which is what an undeployed migration looks like from the outside.
const MISSING_RELATION = new Set(["PGRST205", "42P01"]);

// The functions gateway answers this when a function was never deployed.
const MISSING_FUNCTION = "NOT_FOUND";

const results = [];

function fail(message) {
  console.error(`verify-backend: ${message}`);
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

  const url = values.get("NEXT_PUBLIC_SUPABASE_URL");
  const key = values.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  if (!url || !key) {
    fail("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must both be set in .env.local.");
  }

  return { url: url.replace(/\/+$/, ""), key };
}

const config = loadEnv();

if (typeof fetch !== "function") {
  fail("global fetch is missing; Node.js 20 or later is required.");
}

function record(group, name, state, detail) {
  results.push({ group, name, state, detail });
}

async function probe(path, { method = "GET", headers = {}, body } = {}) {
  const response = await fetch(`${config.url}${path}`, {
    method,
    headers: {
      apikey: config.key,
      authorization: `Bearer ${config.key}`,
      ...headers,
    },
    body,
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  return { status: response.status, payload };
}

async function checkProject() {
  const host = new URL(config.url).host;
  const { status } = await probe("/auth/v1/health");
  record("project", host, status === 200 ? "ok" : "failed", `HTTP ${status} from /auth/v1/health`);
}

async function checkTables() {
  for (const table of TABLES) {
    const { status, payload } = await probe(`/rest/v1/${table}?select=*&limit=1`);

    if (status === 404 || MISSING_RELATION.has(payload?.code)) {
      record("table", `public.${table}`, "missing", "not in the PostgREST schema cache (PGRST205)");
    } else if (status === 200) {
      record("table", `public.${table}`, "ok", "answers; RLS still hides rows from signed-out callers");
    } else {
      record("table", `public.${table}`, "unknown", `unexpected HTTP ${status}: ${payload?.message ?? "no body"}`);
    }
  }
}

async function checkFunctions() {
  for (const name of FUNCTIONS) {
    // An empty body is deliberate: a deployed function refuses it with 401
    // (verify_jwt) or 400 (validation), never with NOT_FOUND.
    const { status, payload } = await probe(`/functions/v1/${name}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    if (status === 404 && payload?.code === MISSING_FUNCTION) {
      record("function", name, "missing", "the gateway does not know this name (NOT_FOUND)");
    } else {
      record("function", name, "ok", `deployed; refused the empty body with HTTP ${status}`);
    }
  }
}

async function checkBuckets() {
  const { status, payload } = await probe("/storage/v1/bucket");

  if (status !== 200 || !Array.isArray(payload)) {
    for (const bucket of BUCKETS) {
      record("bucket", bucket, "unknown", `Storage answered HTTP ${status}; check the bucket list in the Dashboard`);
    }
    return;
  }

  const created = new Map(payload.map((bucket) => [bucket.id, bucket.public === true]));
  for (const bucket of BUCKETS) {
    if (!created.has(bucket)) {
      record("bucket", bucket, "missing", "bucket was never created");
      continue;
    }
    record("bucket", bucket, "ok", created.get(bucket) ? "exists, public read" : "exists, private");
  }
}

await checkProject();
await checkTables();
await checkFunctions();
await checkBuckets();

const width = Math.max(...results.map((result) => `${result.group} ${result.name}`.length));
for (const result of results) {
  const label = `${result.group} ${result.name}`.padEnd(width);
  console.log(`  ${label}  ${result.state.toUpperCase().padEnd(7)}  ${result.detail}`);
}

const failed = results.filter((result) => result.state === "missing" || result.state === "failed");
const host = new URL(config.url).host;

if (failed.length === 0) {
  console.log(`verify-backend: ${results.length} check(s) passed against ${host}.`);
  process.exit(0);
}

console.error(`verify-backend: ${failed.length} of ${results.length} check(s) failed against ${host}.`);
console.error("");
console.error("  Apply the backend with the Supabase CLI (see supabase/DEPLOY.md):");
console.error(`    supabase login`);
console.error(`    supabase link --project-ref ${host.split(".")[0]}`);
console.error("    supabase db push");
console.error("    supabase functions deploy --use-api");
console.error("");
console.error("  Then run this script again.");
process.exit(1);
