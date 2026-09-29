-- 202609260003_realtime.sql
--
-- Realtime (spec sections 25, 44). Three browser subscriptions exist:
--
--   attendance  INSERT filtered by student_id  -> the student QR panel flips to
--                                                 "Attended" without a refresh
--   attendance  INSERT filtered by event_id    -> the scanner's live scan feed
--   events / attendance_sessions / announcements
--                                              -> the notification feed
--
-- A table only streams postgres_changes once it is part of the
-- supabase_realtime publication, so this migration adds the four tables and
-- stays idempotent for re-runs.

do $$
declare
  target text;
  tables text[] := array['attendance', 'attendance_sessions', 'events', 'announcements'];
begin
  -- The publication is created by Supabase itself; create it defensively so a
  -- plain Postgres instance can still run these migrations.
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach target in array tables loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target);
    end if;
  end loop;
end;
$$;

-- The INSERT payload only needs the new row, which Realtime always includes;
-- replica identity stays at the default so row images never leak more than the
-- policies already allow.
