#!/usr/bin/env node
// scripts/check-functions.mjs
//
// Behavioural gate for the four Supabase Edge Functions. They are Deno code and
// the Deno CLI is not installed here, so they are staged into a scratch directory
// inside the project (so node_modules still resolves), the Deno-only `jsr:`
// specifier is pointed at the installed @supabase/supabase-js package, and a stub
// `Deno` global captures the request handlers. Nothing below touches the network:
// the database is a fake thenable query builder.
//
// It proves, in order: the shared module loads in a JavaScript runtime and
// exports everything the four functions import, the pure helpers (Haversine,
// radius and freshness checks, session states, token hashing, request
// validation, HTTP shapes) still behave, the query helpers map rows and errors
// correctly, and every function answers a CORS preflight and refuses a non-POST
// request.
//
// Usage:
//   npm run check:functions
//
// Exit code 0 when every check passes, 1 otherwise.

import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = join(import.meta.dirname, "..");
const STAGE = join(ROOT, ".function-check");
const FUNCTIONS = ["create-attendance-token", "update-student-location", "get-current-attendance-session", "verify-attendance"];

rmSync(STAGE, { recursive: true, force: true });
process.on("exit", () => rmSync(STAGE, { recursive: true, force: true }));
mkdirSync(STAGE, { recursive: true });
writeFileSync(join(STAGE, "package.json"), '{ "type": "module" }\n');
cpSync(join(ROOT, "supabase/functions"), STAGE, { recursive: true });

// Deno resolves `jsr:` itself; Node cannot, and the npm package exports the same
// API. This is the only edit made to a staged copy.
const sharedPath = join(STAGE, "_shared/attendance.js");
const sharedSource = readFileSync(sharedPath, "utf8");
writeFileSync(sharedPath, sharedSource.replaceAll("jsr:@supabase/supabase-js@2", "@supabase/supabase-js"));

const handlers = [];
globalThis.Deno = {
  env: {
    get: (name) =>
      ({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_ANON_KEY: "anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      })[name],
  },
  serve: (handler) => handlers.push(handler),
};

const shared = await import(pathToFileURL(sharedPath).href);
const failures = [];
let passed = 0;

function check(label, condition) {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}

function observed(label, value) {
  console.log(`  note ${label}: ${JSON.stringify(value)}`);
}

async function checkThrows(label, run, code) {
  try {
    await run();
    failures.push(`${label} (nothing was thrown)`);
    console.log(`  FAIL ${label} (nothing was thrown)`);
  } catch (error) {
    check(label, error instanceof Error && (code === undefined || error.code === code));
  }
}

// A thenable stand-in for the Supabase query builder: every chain method returns
// itself, and awaiting it yields the next scripted response.
function fakeService(script) {
  const queue = [...script];
  const builder = new Proxy(
    {},
    {
      get(_target, property) {
        if (property === "then") {
          return (resolve, reject) => {
            try {
              resolve(queue.length > 0 ? queue.shift() : { data: null, error: null, count: null });
            } catch (error) {
              reject(error);
            }
          };
        }
        return () => builder;
      },
    },
  );
  return { from: () => builder };
}

console.log("shared module");
check("attendance.js loads in a JavaScript runtime", typeof shared === "object");
check("the jsr: import resolved to a real client factory", typeof shared.serviceClient === "function");
check("serviceClient() builds a client with .from()", typeof shared.serviceClient().from === "function");

for (const name of FUNCTIONS) {
  const source = readFileSync(join(STAGE, name, "index.js"), "utf8");
  const match = source.match(/import \{([^}]*)\} from "\.\.\/_shared\/attendance\.js";/);
  const imported = match ? match[1].split(",").map((entry) => entry.trim()).filter(Boolean) : [];
  const missing = imported.filter((entry) => shared[entry] === undefined);
  check(`${name}/index.js imports ${imported.length} helpers, all exported`, imported.length > 0 && missing.length === 0);
  if (missing.length > 0) observed(`${name} missing`, missing);
  check(`${name}/index.js has no TypeScript left`, !/:\s*(string|number|boolean|unknown|Record<|Promise<)/.test(source));
}

console.log("\npure helpers");
check("LOCATION_FRESHNESS_MS is 90 seconds", shared.LOCATION_FRESHNESS_MS === 90_000);
check("MAX_TOKEN_LIFETIME_MS is 12 hours", shared.MAX_TOKEN_LIFETIME_MS === 12 * 60 * 60 * 1000);
check("CORS_HEADERS allows POST and OPTIONS", shared.CORS_HEADERS["Access-Control-Allow-Methods"] === "POST, OPTIONS");
check("FAILURE_MESSAGES is populated", Object.keys(shared.FAILURE_MESSAGES).length >= 12);

// Manila to Cebu is a shade over 570 km on a great circle.
const manilaCebu = shared.haversineMeters(14.5995, 120.9842, 10.3157, 123.8854);
observed("Manila to Cebu (m)", Math.round(manilaCebu));
check("haversineMeters matches the known distance", manilaCebu > 560_000 && manilaCebu < 580_000);
check("haversineMeters is zero for one point", shared.haversineMeters(14.6, 121, 14.6, 121) === 0);

check("roundMeters rounds to centimetres", shared.roundMeters(12.3456) === 12.35);
check("roundMeters passes NaN through", Number.isNaN(shared.roundMeters(Number.NaN)));
check("toNumber parses a numeric string", shared.toNumber("12.5") === 12.5);
observed("toNumber(null)", shared.toNumber(null));

check("published events accept attendance", shared.isEventAcceptingAttendance({ status: "published" }) === true);
check("ongoing events accept attendance", shared.isEventAcceptingAttendance({ status: "ongoing" }) === true);
for (const status of ["draft", "completed", "cancelled"]) {
  check(`${status} events refuse attendance`, shared.isEventAcceptingAttendance({ status }) === false);
}

const session = {
  id: "session-1",
  name: "Morning",
  status: "scheduled",
  starts_at: new Date(Date.now() - 60_000).toISOString(),
  ends_at: new Date(Date.now() + 60_000).toISOString(),
  latitude: 14.5995,
  longitude: 120.9842,
  allowed_radius: 100,
};

const inside = shared.checkLocation(
  { latitude: 14.5995, longitude: 120.9842, location_updated_at: new Date().toISOString() },
  session,
);
check("a fresh position inside the radius passes", inside.ok === true && inside.distance === 0);
check("the session radius is reported back", inside.allowedRadius === 100);

check(
  "a missing position is LOCATION_MISSING",
  shared.checkLocation({ latitude: null, longitude: null, location_updated_at: null }, session).code === "LOCATION_MISSING",
);
check(
  "a 200 second old position is LOCATION_STALE",
  shared.checkLocation(
    { latitude: 14.5995, longitude: 120.9842, location_updated_at: new Date(Date.now() - 200_000).toISOString() },
    session,
  ).code === "LOCATION_STALE",
);

const farAway = shared.checkLocation(
  { latitude: 14.6, longitude: 121, location_updated_at: new Date().toISOString() },
  session,
);
check("a position outside the radius is OUT_OF_RADIUS", farAway.ok === false && farAway.code === "OUT_OF_RADIUS");
check("the rejection carries the measured distance", farAway.distance > 100 && farAway.allowedRadius === 100);
check(
  "the radius boundary itself is accepted",
  shared.checkLocation(
    { latitude: 14.5995, longitude: 120.9842, location_updated_at: new Date().toISOString() },
    { ...session, allowed_radius: 0 },
  ).ok === true,
);

console.log("\nsession state machine");
const now = Date.now();
const at = (offsetMs) => new Date(now + offsetMs).toISOString();
const openSessionRow = { id: "open", name: "Morning", status: "scheduled", starts_at: at(-60_000), ends_at: at(60_000) };
const nextSessionRow = { id: "next", name: "Afternoon", status: "scheduled", starts_at: at(3_600_000), ends_at: at(7_200_000) };
const pastSessionRow = { id: "past", name: "Yesterday", status: "scheduled", starts_at: at(-7_200_000), ends_at: at(-3_600_000) };
const cancelledRow = { id: "cancelled", name: "Called off", status: "cancelled", starts_at: at(-60_000), ends_at: at(60_000) };

observed("sessionState inside the window", shared.sessionState("scheduled", openSessionRow.starts_at, openSessionRow.ends_at));
observed("sessionState before the window", shared.sessionState("scheduled", nextSessionRow.starts_at, nextSessionRow.ends_at));
observed("sessionState after the window", shared.sessionState("scheduled", pastSessionRow.starts_at, pastSessionRow.ends_at));
check("a cancelled session never reads as active", shared.sessionState("cancelled", cancelledRow.starts_at, cancelledRow.ends_at) === "cancelled");
check("findOpenSession finds the window that contains now", shared.findOpenSession([pastSessionRow, openSessionRow, nextSessionRow])?.id === "open");
check("findOpenSession ignores a cancelled window", shared.findOpenSession([cancelledRow]) === null);
check("findOpenSession returns null when nothing is open", shared.findOpenSession([nextSessionRow]) === null);
check(
  "findNextSession takes the earliest upcoming window",
  shared.findNextSession([nextSessionRow, { ...nextSessionRow, id: "sooner", starts_at: at(1_800_000) }])?.id === "sooner",
);
check("findNextSession ignores past windows", shared.findNextSession([pastSessionRow]) === null);
const summary = shared.toSessionSummary(openSessionRow);
check("toSessionSummary carries id, name and state", summary.id === "open" && summary.name === "Morning" && typeof summary.state === "string");
observed("session summary", summary);

console.log("\ntoken helpers");
const raw = shared.createRawToken();
check("createRawToken returns a long random string", typeof raw === "string" && raw.length >= 32);
check("createRawToken does not repeat itself", shared.createRawToken() !== shared.createRawToken());
const digest = await shared.hashToken(raw);
const expectedDigest = Buffer.from(await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw))).toString("hex");
check("hashToken is the SHA-256 hex of the raw token", digest === expectedDigest && digest.length === 64);
check("hashToken is stable", (await shared.hashToken(raw)) === digest);
check("a different token hashes differently", (await shared.hashToken(`${raw}x`)) !== digest);
check("requireRawToken accepts a minted token", shared.requireRawToken(raw) === raw);
await checkThrows("requireRawToken rejects a short token", () => shared.requireRawToken("nope"));

console.log("\nrequest validation");
const uuid = "11111111-2222-4333-8444-555555555555";
check("requireUuid accepts a uuid", shared.requireUuid(uuid, "event_id") === uuid);
await checkThrows("requireUuid rejects junk", () => shared.requireUuid("not-a-uuid", "event_id"));
check("requireCoordinate parses a numeric string", shared.requireCoordinate("14.6", "latitude", 90) === 14.6);
await checkThrows("requireCoordinate rejects an out of range value", () => shared.requireCoordinate(91, "latitude", 90));
await checkThrows("readBody rejects an absent body", () => shared.readBody(null), "invalid_request");
check("readBody passes a JSON object through", shared.readBody({ token: "x" }).token === "x");

console.log("\nhttp responses");
const created = shared.jsonResponse({ ok: true }, 201);
check("jsonResponse sets the status", created.status === 201);
check("jsonResponse sets the CORS header", created.headers.get("Access-Control-Allow-Origin") === "*");
check("jsonResponse sends JSON", (created.headers.get("Content-Type") || "").includes("application/json"));
check("jsonResponse body round-trips", (await created.json()).ok === true);
const preflight = shared.corsPreflight();
check("corsPreflight answers 2xx", preflight.status >= 200 && preflight.status < 300);
check("corsPreflight advertises POST", (preflight.headers.get("Access-Control-Allow-Methods") || "").includes("POST"));
const rejected = shared.rejection("OUT_OF_RADIUS");
check("a refusal still answers HTTP 200", rejected.status === 200);
const rejectedBody = await rejected.json();
check("a refusal carries ok:false and the code", rejectedBody.ok === false && rejectedBody.code === "OUT_OF_RADIUS");
check("a refusal carries a readable sentence", typeof rejectedBody.message === "string" && rejectedBody.message.length > 0);
observed("refusal body", rejectedBody);
const forbidden = shared.handleError(new shared.HttpError("forbidden", undefined, 403));
check("handleError keeps an HttpError status", forbidden.status === 403);
observed("forbidden body", await forbidden.json());
const unexpected = shared.handleError(new Error("boom"));
check("handleError turns a crash into a 500", unexpected.status === 500);
observed("unexpected body", await unexpected.json());
const jsonRequest = new Request("https://example.test/fn", {
  method: "POST",
  body: JSON.stringify({ a: 1 }),
  headers: { "content-type": "application/json" },
});
check("readJson parses a JSON body", (await shared.readJson(jsonRequest)).a === 1);
const brokenRequest = new Request("https://example.test/fn", { method: "POST", body: "{" });
const recovered = await shared.readJson(brokenRequest);
check("readJson never throws on a malformed body", Object.keys(recovered || {}).length === 0);
await checkThrows(
  "a malformed body then fails uuid validation",
  () => shared.requireUuid(shared.readBody(recovered).event_id, "event_id"),
  "invalid_request",
);

console.log("\ndatabase helpers against a fake client");
const registrationRow = { id: "reg-1", status: "registered", registered_at: at(-1000), cancelled_at: null };
check(
  "loadRegistration returns the row",
  (await shared.loadRegistration(fakeService([{ data: registrationRow, error: null }]), "event", "student"))?.id === "reg-1",
);
check("loadRegistration returns null when absent", (await shared.loadRegistration(fakeService([{ data: null, error: null }]), "event", "student")) === null);
await checkThrows(
  "loadRegistration surfaces a query error",
  () => shared.loadRegistration(fakeService([{ data: null, error: { message: "boom" } }]), "event", "student"),
  "unexpected",
);
check("hasAttended is true when a present row exists", (await shared.hasAttended(fakeService([{ count: 1, error: null }]), "s", "u")) === true);
check("hasAttended is false when the count is zero", (await shared.hasAttended(fakeService([{ count: 0, error: null }]), "s", "u")) === false);
let scannerAccepted = true;
try {
  await shared.assertScanner(fakeService([{ count: 2, error: null }]), "event", "user");
} catch {
  scannerAccepted = false;
}
check("assertScanner accepts an assigned scanner", scannerAccepted);
await checkThrows(
  "assertScanner refuses a stranger with 403",
  () => shared.assertScanner(fakeService([{ count: 0, error: null }]), "event", "user"),
  "forbidden",
);
check("listSessions defaults to an empty list", (await shared.listSessions(fakeService([{ data: null, error: null }]), "event")).length === 0);
check("listSessions returns the rows", (await shared.listSessions(fakeService([{ data: [openSessionRow], error: null }]), "event")).length === 1);

console.log("\nrequest handlers");
for (const name of FUNCTIONS) await import(pathToFileURL(join(STAGE, name, "index.js")).href);
check("all four functions registered a Deno.serve handler", handlers.length === FUNCTIONS.length);
for (const [index, name] of FUNCTIONS.entries()) {
  const handler = handlers[index];
  const options = await handler(new Request(`https://example.test/${name}`, { method: "OPTIONS" }));
  check(
    `${name} answers the CORS preflight`,
    options.status >= 200 && options.status < 300 && options.headers.get("Access-Control-Allow-Origin") === "*",
  );
  const wrongMethod = await handler(new Request(`https://example.test/${name}`, { method: "GET" }));
  const wrongBody = await wrongMethod.json();
  check(`${name} rejects GET with 405 invalid_request`, wrongMethod.status === 405 && wrongBody.error === "invalid_request");
}

rmSync(STAGE, { recursive: true, force: true });

console.log(`\ncheck-functions: ${passed} check(s) passed, ${failures.length} failed.`);
if (failures.length > 0) {
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
