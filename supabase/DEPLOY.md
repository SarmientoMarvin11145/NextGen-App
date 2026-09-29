# Deploying this backend

The app talks to whatever project `.env.local` names, so a clone can install,
lint, type check, build, and start while that project is still empty. Nothing in
the repository notices the difference. `npm run verify:backend` does:

```
  project hxthhylnunwxhckdeuxg.supabase.co  OK       HTTP 200 from /auth/v1/health
  table public.profiles                     OK       answers; RLS still hides rows from signed-out callers
  table public.events                       MISSING  not in the PostgREST schema cache (PGRST205)
  function verify-attendance                MISSING  the gateway does not know this name (NOT_FOUND)
  bucket nextgen-files                      MISSING  bucket was never created
```

**OK** means the object answers with the publishable key. **MISSING** means it
was never created. **UNKNOWN** means the probe could not tell (a non-200 from
Storage); check the Dashboard by hand. The script exits 0 only when all sixteen
checks pass.

What has to exist, and where it comes from:

| Object | Source |
| --- | --- |
| 9 tables (`profiles`, `announcements`, `files`, `events`, `event_registrations`, `attendance_sessions`, `attendance_scanners`, `attendance_tokens`, `attendance`), every RLS policy and both storage buckets | `migrations/202609240001_dashboard_schema.sql`, `migrations/202609260001_events_attendance_schema.sql` |
| `db_now`, `attendance_session_state`, `event_registration_counts`, `attendance_sessions_with_state`, the trigger functions | `migrations/202609260002_rpc_helpers.sql` |
| the `supabase_realtime` publication (`attendance`, `attendance_sessions`, `events`, `announcements`) | `migrations/202609260003_realtime.sql` |
| the four Edge Functions | `functions/*/index.js`, reached through the `functions/*/index.ts` entry point |

Apply them in filename order. The order matters: `0002` and `0003` reference
objects from `0001`/`0002`.

Every migration is written to be re-runnable — `create table if not exists`,
`drop policy if exists` before each `create policy`, `drop trigger if exists`
before each `create trigger`, `create or replace function`, and a guarded
`do $$` block for the publication. None of them drops a table or deletes rows,
so pushing over a project that already holds half the schema (or real data)
is safe.

## Path A: Supabase CLI (recommended)

`supabase` is already a dev dependency, so `npm install` restores it and every
command below is run through `npx`. On Windows run them in **Command Prompt**:
PowerShell refuses `npm.ps1`/`npx.ps1` while the execution policy is
`Restricted`, which is the machine default.

1. **Sign in.** Create a personal access token at
   <https://supabase.com/dashboard/account/tokens>, then either

   ```
   npx supabase login --token sbp_...
   ```

   or run `npx supabase login` and finish in the browser.

2. **Link the project.** The ref is the first label of
   `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`.

   ```
   npx supabase link --project-ref <project-ref>
   npx supabase link --project-ref <project-ref> --password <db-password>   # non-interactive
   ```

   It prompts for the database password (Dashboard, Settings, Database,
   "Reset database password" if you no longer have it).

3. **Look before you push.**

   ```
   npx supabase db push --dry-run
   ```

   If this reports nothing to apply while `verify:backend` still shows missing
   tables, the remote migration history believes they already ran. Push anyway
   with `--include-all` in step 4.

4. **Apply the migrations.**

   ```
   npx supabase db push
   ```

   This creates both storage buckets too — they are `insert into
   storage.buckets` statements inside the first migration, not manual setup.

5. **Deploy the four functions.**

   ```
   npx supabase functions deploy --use-api
   ```

   Steps 4 and 5 are independent. `functions deploy` needs only a login (and
   `--project-ref <ref>` when the project is not linked), and never asks for the
   database password, so the functions can already be live while the tables are
   still waiting on a push. Watch the upload lines: each function should ship
   `index.ts`, `index.js`, and `_shared/attendance.js`.

   `--use-api` bundles server-side, so Docker is not required. Deploying with no
   function name sends all four, which is what you want: they share
   `_shared/attendance.js`. `verify_jwt = true` is read from
   `supabase/config.toml`, so never add `--no-verify-jwt`.

6. **No secrets to configure.** The functions read `SUPABASE_URL`,
   `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`, which the platform
   injects into every function at runtime.

7. **Confirm.** `npm run verify:backend` should now print
   `verify-backend: 16 check(s) passed`.

## Path B: Dashboard only (no CLI)

**Migrations.** Dashboard, SQL Editor, "New query": paste one file at a time and
press Run, in this order.

1. `migrations/202609240001_dashboard_schema.sql` — profiles, announcements,
   file metadata, the `nextgen-files` and `nextgen-event-banners` buckets, and
   the `on_auth_user_created` trigger on `auth.users`.
2. `migrations/202609260001_events_attendance_schema.sql` — events,
   registrations, sessions, scanners, tokens, attendance, and every RLS policy.
3. `migrations/202609260002_rpc_helpers.sql` — the clock and state helpers.
4. `migrations/202609260003_realtime.sql` — the realtime publication.

What to look at afterwards, because not all of it is visible in the Table
Editor:

* Storage should list `nextgen-files` as private and `nextgen-event-banners` as
  public read (event banners are rendered for signed-out visitors).
* Database, Publications, `supabase_realtime` should carry the four tables.
* Database, Triggers, `auth` schema should carry `on_auth_user_created`. Without
  it a signup creates an auth user but no `profiles` row, and the app has
  nothing to read.

**Edge Functions.** The Dashboard editor deploys one function file, and that file
is always named `index.ts`. All four functions here import
`../_shared/attendance.js`, so copying a single file leaves an unresolved import
and the deploy fails. Either

* use Path A for the functions — it needs no Docker — or
* paste the contents of `index.js` into the editor (not `index.ts`, which is only
  the one line the CLI needs to find the function) and fold the helpers from
  `_shared/attendance.js` into the top of that paste, deleting the
  `import { ... } from "../_shared/attendance.js"` line while keeping the
  `jsr:@supabase/supabase-js@2` import as it is.

Function names must match exactly (`create-attendance-token`,
`update-student-location`, `get-current-attendance-session`,
`verify-attendance`) because the app invokes them by name, and "Enforce JWT
Verification" must stay on for all four to match `config.toml`. The Dashboard
editor has no version control and no rollback, so treat this repository as the
source of truth and use the editor only as a last resort.

## After the backend answers

`verify:backend` uses the publishable key, so passing checks prove the schema is
deployed and readable — not that the service-role path works end to end. The
only proof of that is one full scan:

1. Create an account through the app's own signup form (this exercises the
   `auth.users` trigger).
2. Promote it: `update public.profiles set role = 'admin' where email = '<you>';`
3. As admin: create a published event, add a session whose window includes the
   present, and assign a scanner in `attendance_scanners`.
4. Register a second account for that event, open its attendance panel (this
   mints the QR token and starts the 60-second location reports), and scan it
   from the assigned scanner.

A refusal is still a working backend: `verify-attendance` answers HTTP 200 with
`{ ok: false, code, message }` and stores a `rejected` row, which is what the
admin report reads.

## If a step fails

* `supabase db push` cannot connect — pass `--password <db-password>`, or a full
  connection string through `--db-url "postgresql://postgres.<ref>:<password>@<host>:6543/postgres"`.
* `supabase functions deploy` complains about Docker — add `--use-api`.
* A deploy prints `WARN: failed to read file: open …/index.ts: no such file or
  directory` — the CLI only reads an entry point named `index.ts`, so that
  function was uploaded with no code in it and every call to it will fail. The
  one-line `functions/<name>/index.ts` is what keeps this from happening;
  `index.js` is loaded through it.
* A function answers `401 UNAUTHORIZED` when you probe it by hand — expected:
  verification is on and your request carried no user JWT. The app sends the
  signed-in user's token.
* A table is still `MISSING` after a push — run
  `npx supabase migration list` and, if the local files are absent from the
  remote column, `npx supabase db push --include-all`. Re-running is harmless.
* The push stops on a policy that references a missing column — `profiles` and
  `announcements` already exist on the project while everything else is absent,
  which means they came from an earlier partial deploy, and
  `create table if not exists` deliberately leaves them exactly as it found
  them. Line up that table's columns with the migration and add what is
  missing, or drop the two tables first if they hold nothing you need.
