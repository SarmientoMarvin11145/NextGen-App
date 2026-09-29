-- 202609260001_events_attendance_schema.sql
--
-- The time-based QR attendance core (spec sections 4 to 22).
--
-- Two kinds of time exist here on purpose:
--   * event_date / start_time / end_time  display only, no timezone maths
--   * starts_at / ends_at (timestamptz)    the authoritative window, always
--                                          compared against the database clock
--
-- The browser never writes attendance itself. Rows in public.attendance are
-- only created by the verify-attendance Edge Function with the service-role
-- key, and this file makes that the only possible path.

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_url text,
  event_date date not null,
  start_time time not null,
  end_time time not null,
  location_name text not null,
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  allowed_radius integer not null default 20,
  registration_deadline timestamptz,
  max_participants integer,
  status text not null default 'draft',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_status_check
    check (status in ('draft', 'published', 'ongoing', 'completed', 'cancelled')),
  constraint events_name_length check (char_length(name) between 3 and 160),
  constraint events_radius_check check (allowed_radius between 1 and 10000),
  constraint events_latitude_check check (latitude between -90 and 90),
  constraint events_longitude_check check (longitude between -180 and 180),
  constraint events_capacity_check check (max_participants is null or max_participants > 0)
);

comment on column public.events.status is
  'draft | published | ongoing | completed | cancelled. Only non-draft events are visible to students.';

create index if not exists events_status_idx on public.events (status, event_date desc);
create index if not exists events_event_date_idx on public.events (event_date desc);

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

create or replace function public.stamp_event_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists events_stamp_author on public.events;
create trigger events_stamp_author
  before insert on public.events
  for each row execute function public.stamp_event_author();

-- A cancelled event must not keep taking attendance: its not-yet-started
-- sessions are closed out at the same time.
create or replace function public.cancel_event_sessions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    update public.attendance_sessions
      set status = 'cancelled'
      where event_id = new.id and status = 'scheduled' and starts_at > now();
  end if;
  return new;
end;
$$;

drop trigger if exists events_cancel_sessions on public.events;
create trigger events_cancel_sessions
  after update on public.events
  for each row execute function public.cancel_event_sessions();

-- ---------------------------------------------------------------------------
-- event_registrations
-- ---------------------------------------------------------------------------

create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  student_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status text not null default 'registered',
  registered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_registrations_status_check
    check (status in ('registered', 'cancelled', 'waitlist')),
  constraint event_registrations_unique_student unique (event_id, student_id)
);

create index if not exists event_registrations_student_idx
  on public.event_registrations (student_id, status);
create index if not exists event_registrations_event_idx
  on public.event_registrations (event_id, status);

drop trigger if exists event_registrations_set_updated_at on public.event_registrations;
create trigger event_registrations_set_updated_at
  before update on public.event_registrations
  for each row execute function public.set_updated_at();

-- The database is the authority on whether a student may register: the event
-- status must allow it, the deadline must not have passed, and there must be a
-- free slot. The client checks the same three things only to disable a button.
create or replace function public.enforce_registration_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.events;
  taken integer;
  activating boolean;
begin
  if new.student_id is null then
    new.student_id := auth.uid();
  end if;

  if auth.uid() is not null and new.student_id <> auth.uid() and not public.is_admin() then
    raise exception 'Only your own registration can be changed.'
      using errcode = '42501';
  end if;

  activating := new.status = 'registered'
    and (tg_op = 'INSERT' or old.status is distinct from 'registered');

  if activating then
    select * into target from public.events where id = new.event_id;

    if target.id is null then
      raise exception 'That event no longer exists.' using errcode = '23503';
    end if;

    if target.status not in ('published', 'ongoing') then
      raise exception 'Registration for this event is closed.' using errcode = '22023';
    end if;

    if target.registration_deadline is not null and target.registration_deadline < now() then
      raise exception 'The registration deadline has passed.' using errcode = '22023';
    end if;

    if target.max_participants is not null then
      select count(*) into taken
      from public.event_registrations
      where event_id = new.event_id and status = 'registered';

      if taken >= target.max_participants then
        raise exception 'This event has reached its participant limit.' using errcode = '22023';
      end if;
    end if;

    new.registered_at := now();
    new.cancelled_at := null;
  elsif new.status = 'cancelled' then
    new.cancelled_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists event_registrations_enforce_rules on public.event_registrations;
create trigger event_registrations_enforce_rules
  before insert or update on public.event_registrations
  for each row execute function public.enforce_registration_rules();

-- ---------------------------------------------------------------------------
-- attendance_sessions
-- ---------------------------------------------------------------------------
-- `status` is only scheduled or cancelled. upcoming / active / closed are
-- derived from the database clock by attendance_session_state().

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  session_date date not null,
  start_time time not null,
  end_time time not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  allowed_radius integer not null default 20,
  status text not null default 'scheduled',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_sessions_status_check check (status in ('scheduled', 'cancelled')),
  constraint attendance_sessions_window_check check (ends_at > starts_at),
  constraint attendance_sessions_radius_check check (allowed_radius between 1 and 10000),
  constraint attendance_sessions_latitude_check check (latitude between -90 and 90),
  constraint attendance_sessions_longitude_check check (longitude between -180 and 180)
);

create index if not exists attendance_sessions_event_idx
  on public.attendance_sessions (event_id, starts_at);
create index if not exists attendance_sessions_window_idx
  on public.attendance_sessions (starts_at, ends_at);

drop trigger if exists attendance_sessions_set_updated_at on public.attendance_sessions;
create trigger attendance_sessions_set_updated_at
  before update on public.attendance_sessions
  for each row execute function public.set_updated_at();

create or replace function public.stamp_session_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists attendance_sessions_stamp_author on public.attendance_sessions;
create trigger attendance_sessions_stamp_author
  before insert on public.attendance_sessions
  for each row execute function public.stamp_session_author();

-- Spec section 41: a session may only be edited or deleted BEFORE it starts.
-- Cancelling a session that is already running is still allowed, because that
-- is exactly when an administrator needs to stop attendance.
create or replace function public.enforce_session_prestart_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.starts_at > now() then
    return case tg_op when 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'A session that has already started cannot be deleted.'
      using errcode = '22023';
  end if;

  if new.status = 'cancelled'
     and new.name = old.name
     and new.session_date = old.session_date
     and new.start_time = old.start_time
     and new.end_time = old.end_time
     and new.starts_at = old.starts_at
     and new.ends_at = old.ends_at
     and new.latitude = old.latitude
     and new.longitude = old.longitude
     and new.allowed_radius = old.allowed_radius then
    return new;
  end if;

  raise exception 'A session that has already started can only be cancelled, not edited.'
    using errcode = '22023';
end;
$$;

drop trigger if exists attendance_sessions_prestart_guard on public.attendance_sessions;
create trigger attendance_sessions_prestart_guard
  before update or delete on public.attendance_sessions
  for each row execute function public.enforce_session_prestart_changes();

-- ---------------------------------------------------------------------------
-- attendance_scanners
-- ---------------------------------------------------------------------------
-- Scanner rights come from this table, never from profiles.role (spec section 14).

create table if not exists public.attendance_scanners (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  assigned_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint attendance_scanners_unique_pair unique (event_id, user_id)
);

create index if not exists attendance_scanners_user_idx
  on public.attendance_scanners (user_id, event_id);
create index if not exists attendance_scanners_event_idx on public.attendance_scanners (event_id);

-- ---------------------------------------------------------------------------
-- attendance_tokens
-- ---------------------------------------------------------------------------
-- One short-lived token per student per session (spec sections 7 to 11).
--
-- The raw token is minted by create-attendance-token, returned to the student's
-- own browser exactly once, and immediately forgotten. Only its SHA-256 digest
-- is stored here, so neither the database nor an administrator can reconstruct
-- a scannable QR code. The student's device position is written onto the token
-- row by update-student-location and read back by verify-attendance.

create table if not exists public.attendance_tokens (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  attendance_session_id uuid not null references public.attendance_sessions (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  location_updated_at timestamptz,
  created_at timestamptz not null default now(),
  -- A code can never be minted already expired, and it can never be burned
  -- after its own window has closed.
  constraint attendance_tokens_expiry_check check (expires_at > created_at),
  constraint attendance_tokens_used_check check (used_at is null or used_at <= expires_at)
);

create index if not exists attendance_tokens_student_idx
  on public.attendance_tokens (student_id, attendance_session_id);
create index if not exists attendance_tokens_hash_idx on public.attendance_tokens (token_hash);

-- Re-minting for the same student and session rotates the digest on this one
-- row instead of leaving several live codes behind (spec section 10).
create unique index if not exists attendance_tokens_one_per_session
  on public.attendance_tokens (attendance_session_id, student_id);

-- ---------------------------------------------------------------------------
-- attendance
-- ---------------------------------------------------------------------------
-- One row per scan attempt. A successful scan is status 'present' and is the
-- permanent record; a refused scan is status 'rejected' plus the machine
-- readable failure_code, which is what the /admin/attendance report shows.

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  attendance_session_id uuid not null references public.attendance_sessions (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  scanner_id uuid references auth.users (id) on delete set null,
  recorded_at timestamptz not null default now(),
  status text not null default 'present',
  failure_code text,
  student_latitude numeric(9, 6),
  student_longitude numeric(9, 6),
  distance_meters numeric(10, 2),
  allowed_radius integer,
  location_verified boolean not null default false,
  created_at timestamptz not null default now(),
  constraint attendance_status_check check (status in ('present', 'rejected'))
);

create index if not exists attendance_event_idx on public.attendance (event_id, recorded_at desc);
create index if not exists attendance_session_idx
  on public.attendance (attendance_session_id, recorded_at desc);
create index if not exists attendance_student_idx on public.attendance (student_id, recorded_at desc);
create index if not exists attendance_scanner_idx on public.attendance (scanner_id);

-- A student can only ever hold ONE recorded attendance per session. Partial so
-- that refused attempts (which are kept for the report) never block a later,
-- successful scan.
create unique index if not exists attendance_one_present_per_session
  on public.attendance (attendance_session_id, student_id)
  where status = 'present';

-- ---------------------------------------------------------------------------
-- row level security
-- ---------------------------------------------------------------------------
-- Writes to attendance are impossible from a browser session: public.attendance
-- has no INSERT policy at all, so only the service-role key used by the
-- verify-attendance Edge Function can create rows (spec sections 30, 34).

alter table public.events enable row level security;
alter table public.event_registrations enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_scanners enable row level security;
alter table public.attendance_tokens enable row level security;
alter table public.attendance enable row level security;

-- events -------------------------------------------------------------------
drop policy if exists events_select_visible on public.events;
create policy events_select_visible
  on public.events for select
  to authenticated
  using (
    status <> 'draft'
    or public.is_admin()
    or exists (
      select 1 from public.attendance_scanners s
      where s.event_id = events.id and s.user_id = auth.uid()
    )
  );

drop policy if exists events_insert_admin on public.events;
create policy events_insert_admin
  on public.events for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists events_update_admin on public.events;
create policy events_update_admin
  on public.events for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists events_delete_admin on public.events;
create policy events_delete_admin
  on public.events for delete
  to authenticated
  using (public.is_admin());

-- event_registrations ------------------------------------------------------
drop policy if exists event_registrations_select_own on public.event_registrations;
create policy event_registrations_select_own
  on public.event_registrations for select
  to authenticated
  using (student_id = auth.uid() or public.is_admin());

drop policy if exists event_registrations_insert_own on public.event_registrations;
create policy event_registrations_insert_own
  on public.event_registrations for insert
  to authenticated
  with check (student_id = auth.uid() or public.is_admin());

drop policy if exists event_registrations_update_own on public.event_registrations;
create policy event_registrations_update_own
  on public.event_registrations for update
  to authenticated
  using (student_id = auth.uid() or public.is_admin())
  with check (student_id = auth.uid() or public.is_admin());

drop policy if exists event_registrations_delete_admin on public.event_registrations;
create policy event_registrations_delete_admin
  on public.event_registrations for delete
  to authenticated
  using (public.is_admin());

-- attendance_sessions ------------------------------------------------------
drop policy if exists attendance_sessions_select_visible on public.attendance_sessions;
create policy attendance_sessions_select_visible
  on public.attendance_sessions for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.events e
      where e.id = attendance_sessions.event_id and e.status <> 'draft'
    )
    or exists (
      select 1 from public.attendance_scanners s
      where s.event_id = attendance_sessions.event_id and s.user_id = auth.uid()
    )
  );

drop policy if exists attendance_sessions_insert_admin on public.attendance_sessions;
create policy attendance_sessions_insert_admin
  on public.attendance_sessions for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists attendance_sessions_update_admin on public.attendance_sessions;
create policy attendance_sessions_update_admin
  on public.attendance_sessions for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists attendance_sessions_delete_admin on public.attendance_sessions;
create policy attendance_sessions_delete_admin
  on public.attendance_sessions for delete
  to authenticated
  using (public.is_admin());

-- attendance_scanners ------------------------------------------------------
drop policy if exists attendance_scanners_select_own on public.attendance_scanners;
create policy attendance_scanners_select_own
  on public.attendance_scanners for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists attendance_scanners_insert_admin on public.attendance_scanners;
create policy attendance_scanners_insert_admin
  on public.attendance_scanners for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists attendance_scanners_update_admin on public.attendance_scanners;
create policy attendance_scanners_update_admin
  on public.attendance_scanners for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists attendance_scanners_delete_admin on public.attendance_scanners;
create policy attendance_scanners_delete_admin
  on public.attendance_scanners for delete
  to authenticated
  using (public.is_admin());

-- attendance_tokens --------------------------------------------------------
-- Deliberately no policy: the digest and the reported position may only be
-- read or written by the Edge Functions, which hold the service-role key.

-- attendance ---------------------------------------------------------------
-- Students read their own records (the QR panel subscribes to INSERTs on this
-- table), assigned scanners read the live feed for their event, and
-- administrators read everything. Nobody inserts from the client.
drop policy if exists attendance_select_visible on public.attendance;
create policy attendance_select_visible
  on public.attendance for select
  to authenticated
  using (
    student_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.attendance_scanners s
      where s.event_id = attendance.event_id and s.user_id = auth.uid()
    )
  );
