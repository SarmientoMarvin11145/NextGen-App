-- 202609260002_rpc_helpers.sql
--
-- The three server-side helpers the frontend calls directly plus the derived
-- session state every surface shares.
--
--   db_now()                      the authoritative "now" (spec section 12)
--   event_registration_counts()   live slot counts in one round trip
--   attendance_session_state()    upcoming | active | closed | cancelled
--
-- Attendance state is NEVER computed in the browser: the student QR panel, the
-- scanner, and the admin schedule all read it from here or from the Edge
-- Functions that call the same rule (spec sections 7, 12, 45).

-- ---------------------------------------------------------------------------
-- db_now
-- ---------------------------------------------------------------------------

create or replace function public.db_now()
returns timestamptz
language sql
stable
as $$
  select now();
$$;

comment on function public.db_now() is
  'The database clock. Every countdown in the UI is offset from this value so a wrong device clock cannot open or close a session.';

-- ---------------------------------------------------------------------------
-- attendance_session_state
-- ---------------------------------------------------------------------------
-- `status` in the table is only scheduled/cancelled; upcoming, active, and
-- closed are derived from the clock.

create or replace function public.attendance_session_state(
  p_status text,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
returns text
language sql
stable
as $$
  select case
    when p_status = 'cancelled' then 'cancelled'
    when p_starts_at is null or p_ends_at is null then 'closed'
    when now() < p_starts_at then 'upcoming'
    when now() >= p_starts_at and now() < p_ends_at then 'active'
    else 'closed'
  end;
$$;

create or replace function public.attendance_session_state(p_session_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.attendance_session_state(s.status, s.starts_at, s.ends_at)
  from public.attendance_sessions s
  where s.id = p_session_id;
$$;

-- A session list that already carries its clock-derived state. security_invoker
-- keeps the caller's RLS in force, so a student still only sees sessions of
-- events that are not drafts.
create or replace view public.attendance_sessions_with_state
with (security_invoker = true) as
  select
    s.*,
    public.attendance_session_state(s.status, s.starts_at, s.ends_at) as state
  from public.attendance_sessions s;

comment on view public.attendance_sessions_with_state is
  'attendance_sessions plus the derived state (upcoming | active | closed | cancelled) used by every timeline and schedule.';

-- ---------------------------------------------------------------------------
-- event_registration_counts
-- ---------------------------------------------------------------------------
-- One row per requested event id, including events that nobody registered for,
-- so the caller never has to guess between "zero" and "missing".
--
-- SECURITY DEFINER because a student must see how full an event is even though
-- public.event_registrations only exposes their own row through RLS.

create or replace function public.event_registration_counts(p_event_ids uuid[])
returns table (event_id uuid, registration_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    requested.event_id,
    coalesce(taken.registration_count, 0)::bigint as registration_count
  from (
    select distinct unnest(coalesce(p_event_ids, array[]::uuid[])) as event_id
  ) as requested
  left join (
    select r.event_id, count(*) as registration_count
    from public.event_registrations r
    where r.status = 'registered'
    group by r.event_id
  ) as taken on taken.event_id = requested.event_id;
$$;

comment on function public.event_registration_counts(uuid[]) is
  'Registered-participant count per event id, counting only status = registered.';

-- ---------------------------------------------------------------------------
-- grants
-- ---------------------------------------------------------------------------

revoke all on function public.event_registration_counts(uuid[]) from public;
grant execute on function public.event_registration_counts(uuid[]) to authenticated;

revoke all on function public.db_now() from public;
grant execute on function public.db_now() to authenticated;

grant select on public.attendance_sessions_with_state to authenticated;
