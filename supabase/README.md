# Supabase backend

Everything the portal needs in order to authenticate accounts, publish events,
and record attendance lives in this folder. The Next.js app never touches a
privileged key: it reads and writes through Row Level Security, and every
attendance decision is made by an Edge Function running with the service-role
key.

## Layout

```
supabase/
  config.toml                                   verify_jwt = true for all four functions
  migrations/202609240001_dashboard_schema.sql   profiles, announcements, files, both storage buckets
  migrations/202609260001_events_attendance_schema.sql
                                                events, registrations, sessions, scanners,
                                                tokens, attendance + every RLS policy
  migrations/202609260002_rpc_helpers.sql        db_now, event_registration_counts,
                                                attendance_session_state, attendance_sessions_with_state
  migrations/202609260003_realtime.sql           realtime publication (attendance, sessions, events,
                                                announcements)
  functions/_shared/attendance.js                validation, hashing, Haversine, session helpers
  functions/<name>/index.js                      the implementation: routes, queries, Deno.serve
  functions/<name>/index.ts                      one line - `import "./index.js";` (see below)
                                                <name> is create-attendance-token,
                                                update-student-location,
                                                get-current-attendance-session,
                                                verify-attendance
```

## Applying the backend

Step by step instructions, including the Dashboard fallback and what to check
afterwards, live in [DEPLOY.md](DEPLOY.md). The short version:

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push
supabase functions deploy --use-api   # bundles server-side, so Docker is not needed
npm run verify:backend                # 16 checks: tables, functions, buckets
```

Deploying with no function name sends all four, which is required here because
they share `_shared/attendance.js`. Every migration is written to be re-runnable,
so pushing over a project that already holds part of the schema is safe.

No custom secrets are required. The functions read `SUPABASE_URL`,
`SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`, all of which the platform
injects into every function at runtime. The browser only ever holds the
publishable key from `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`).

## The four functions

| Function | Body | Success | Refusals |
| --- | --- | --- | --- |
| `get-current-attendance-session` | `{ event_id }` | `server_now`, `event`, `registration`, `sessions[]` with a derived `state`, `active_session_id`, `next_session`, `attended_session_ids`, `attendance[]`, `access` | `forbidden` on a draft the caller cannot see |
| `create-attendance-token` | `{ event_id }` | `201` with `token` (returned once), `expires_at`, `session` | `not_registered`, `no_active_session`, `already_attended` |
| `update-student-location` | `{ token, latitude, longitude }` | `{ ok: true, recorded_at }` | `token_not_found`, `token_used`, `forbidden` |
| `verify-attendance` | `{ token, event_id }` | `{ ok: true, student_name, session_name, recorded_at, distance_meters, allowed_radius, location_verified }` | `200` with `{ ok: false, code, message }` |

Business refusals from `verify-attendance` answer with HTTP 200 and a machine
readable `code` — `TOKEN_NOT_FOUND`, `TOKEN_EXPIRED`, `TOKEN_USED`,
`EVENT_MISMATCH`, `SESSION_NOT_ACTIVE`, `EVENT_NOT_ACTIVE`, `NOT_REGISTERED`,
`ALREADY_ATTENDED`, `SCANNER_NOT_AUTHORIZED`, `LOCATION_MISSING`,
`LOCATION_STALE`, `OUT_OF_RADIUS` — so the scanner can display the reason
instead of a transport error. Each refusal is also stored as an
`attendance` row with `status = 'rejected'` and the matching `failure_code`,
which is what the admin report reads.

## Rules the schema enforces

* `public.attendance` has no client `INSERT` policy at all: rows are only
  created by `verify-attendance` with the service-role key.
* A student holds exactly one live token per session
  (`attendance_tokens_one_per_session`); re-minting rotates the digest and
  clears the previous coordinates instead of stacking scannable codes.
* Only the SHA-256 digest of a token is stored, so the database cannot
  reconstruct a QR code that has already been shown once.
* A session window is authoritative: `starts_at` / `ends_at` are compared to
  the database clock (`db_now()`, `attendance_session_state()`), never to the
  device clock. `upcoming | active | closed` is always derived, never stored.
* A token expires at `min(session end, 12 hours)` and can never be minted
  already expired or burned after its own window closed.
* Distances are recomputed server-side with Haversine; a reported position
  older than 90 seconds is stale (the panel re-reports every 60 seconds).
* A session that has already started can only be cancelled, never edited or
  deleted; cancelling an event cancels its not-yet-started sessions.
* Scanner rights come from `public.attendance_scanners`, never from
  `profiles.role`.
* `role` and `email` on `profiles` are protected by a trigger, so a student
  cannot promote themselves.

## Local checks

```bash
npm run check:syntax     # SWC-parses every .js/.jsx/.mjs/.ts/.tsx in src, supabase/functions, scripts
npm run check:sql        # structural check of the migrations (quotes, parens, terminators, placeholders)
npm run check:functions  # loads the Edge Functions in Node with a stub Deno: helpers, states, handlers
npm run verify:backend   # probes the project in .env.local: 9 tables, 4 functions, 2 buckets (needs network)
```

There is no TypeScript toolchain in this repository, so there is no `tsc` step to
run: `src/` is JavaScript, and each Edge Function is implemented in JavaScript
(`functions/<name>/index.js` plus `functions/_shared/attendance.js`).

**Why every function directory still holds an `index.ts`:** `supabase functions
deploy` resolves a function's entry point as `index.ts` and only that name - it
never looks for `index.js` - and a directory it cannot read an entry point from
is uploaded anyway, as a function containing no code:

```
WARN: failed to read file: open supabase/functions/verify-attendance/index.ts:
      no such file or directory
```

Each `index.ts` is therefore a single `import "./index.js";` with no types and no
logic to maintain, and the implementation stays in JavaScript.

Behaviour is held up offline by `npm run check:syntax` (parsing), `npm run lint`,
and `npm run check:functions`, which loads the `index.js` modules in Node with a
stub `Deno` global. After a real deploy, `npm run verify:backend` confirms the
entry point worked: it must report every function as `OK` or `401 UNAUTHORIZED`,
both of which prove code is running. A `MISSING` after a deploy that printed the
`WARN` above means the function shipped empty.

