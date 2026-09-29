-- 202609240001_dashboard_schema.sql
--
-- The portal's core schema: profiles, announcements, file metadata, and the two
-- private storage buckets they describe. Every attendance object (events,
-- sessions, registrations, scanners, tokens, attendance) lives in the next
-- migration so the two concerns stay reviewable on their own.
--
-- Rules that the frontend relies on and this file enforces:
--   * a profile row exists for every auth.users row (handle_new_user trigger)
--   * role is an administrative fact and cannot be self-assigned
--   * students see only their own files, administrators see both folders
--   * the storage bucket mirrors the metadata table, folder by folder

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  course text,
  year text,
  block text,
  role text not null default 'student',
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('student', 'admin')),
  constraint profiles_block_check check (block is null or block in ('A', 'B', 'C'))
);

comment on table public.profiles is
  'One row per auth.users account. role drives every admin-only surface and is only changeable by an administrator.';

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_created_at_idx on public.profiles (created_at desc);

-- Used by every admin-only RLS policy and trigger in this schema.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- updated_at bookkeeping shared by every mutable table in this schema.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The service role (and SQL migrations) may change anything.
  if auth.uid() is null then
    return new;
  end if;
  if public.is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role then
    raise exception 'Only administrators can change account roles.'
      using errcode = '42501';
  end if;
  if new.email is distinct from old.email then
    raise exception 'Only administrators can change account email addresses.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_protect_columns on public.profiles;
create trigger profiles_protect_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- A new auth.users row becomes a usable profile immediately. The registration
-- form sends full_name, course, year, block, and terms_accepted as metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    course,
    year,
    block,
    terms_accepted_at
  )
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'course', ''),
    nullif(new.raw_user_meta_data ->> 'year', ''),
    nullif(new.raw_user_meta_data ->> 'block', ''),
    case
      when (new.raw_user_meta_data ->> 'terms_accepted') = 'true' then now()
      else null
    end
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        course = coalesce(excluded.course, public.profiles.course),
        year = coalesce(excluded.year, public.profiles.year),
        block = coalesce(excluded.block, public.profiles.block),
        terms_accepted_at = coalesce(excluded.terms_accepted_at, public.profiles.terms_accepted_at);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin
  on public.profiles for select
  to authenticated
  using (public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- announcements
-- ---------------------------------------------------------------------------

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  published boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_title_length check (char_length(title) between 3 and 120),
  constraint announcements_body_length check (char_length(body) between 5 and 2000)
);

create index if not exists announcements_published_idx
  on public.announcements (published, created_at desc);

drop trigger if exists announcements_set_updated_at on public.announcements;
create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

-- Every announcement is stamped with its author, never trusting the client.
create or replace function public.stamp_announcement_author()
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

drop trigger if exists announcements_stamp_author on public.announcements;
create trigger announcements_stamp_author
  before insert on public.announcements
  for each row execute function public.stamp_announcement_author();

alter table public.announcements enable row level security;

drop policy if exists announcements_select_published on public.announcements;
create policy announcements_select_published
  on public.announcements for select
  to authenticated
  using (published or public.is_admin());

drop policy if exists announcements_insert_admin on public.announcements;
create policy announcements_insert_admin
  on public.announcements for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists announcements_update_admin on public.announcements;
create policy announcements_update_admin
  on public.announcements for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists announcements_delete_admin on public.announcements;
create policy announcements_delete_admin
  on public.announcements for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- files (metadata for objects in the private nextgen-files bucket)
-- ---------------------------------------------------------------------------

create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  owner_email text,
  owner_name text,
  folder text not null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint files_folder_check check (folder in ('admin', 'user')),
  constraint files_size_check check (size_bytes >= 0)
);

create index if not exists files_owner_idx on public.files (owner_id, created_at desc);
create index if not exists files_folder_idx on public.files (folder, created_at desc);

drop trigger if exists files_set_updated_at on public.files;
create trigger files_set_updated_at
  before update on public.files
  for each row execute function public.set_updated_at();

-- Students may only write inside their own "user/<uid>/" namespace and only
-- administrators may use the "admin/" namespace, so the row and the object can
-- never disagree about who owns what.
create or replace function public.stamp_file_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_prefix text;
begin
  if new.owner_id is null then
    new.owner_id := auth.uid();
  end if;

  if auth.uid() is not null and new.owner_id <> auth.uid() and not public.is_admin() then
    raise exception 'Files can only be uploaded to your own folder.'
      using errcode = '42501';
  end if;

  expected_prefix := new.folder || '/' || new.owner_id::text || '/';
  if position(expected_prefix in new.storage_path) <> 1 then
    raise exception 'The storage path must start with %.', expected_prefix
      using errcode = '22023';
  end if;

  if new.folder = 'admin' and not public.is_admin() then
    raise exception 'Only administrators can upload into the admin folder.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists files_stamp_owner on public.files;
create trigger files_stamp_owner
  before insert or update on public.files
  for each row execute function public.stamp_file_owner();

alter table public.files enable row level security;

drop policy if exists files_select_own_or_admin on public.files;
create policy files_select_own_or_admin
  on public.files for select
  to authenticated
  using (owner_id = auth.uid() or public.is_admin());

drop policy if exists files_insert_own on public.files;
create policy files_insert_own
  on public.files for insert
  to authenticated
  with check (
    owner_id = auth.uid()
    and (folder = 'user' or public.is_admin())
  );

drop policy if exists files_delete_own_or_admin on public.files;
create policy files_delete_own_or_admin
  on public.files for delete
  to authenticated
  using (owner_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- storage: two buckets, mirrored by the policies above
-- ---------------------------------------------------------------------------
--
--   nextgen-files          private. Objects live at
--                          user/<uid>/<timestamp>-<name> (students) or
--                          admin/<uid>/<timestamp>-<name> (administrators).
--   nextgen-event-banners  public read. Event banner images uploaded by
--                          administrators live at <uid>/<timestamp>-<name>.

insert into storage.buckets (id, name, public)
values
  ('nextgen-files', 'nextgen-files', false),
  ('nextgen-event-banners', 'nextgen-event-banners', true)
on conflict (id) do update set public = excluded.public;

-- Private files: a student reads their own namespace, an administrator reads
-- everything (that is what /admin/files depends on).
drop policy if exists nextgen_files_select on storage.objects;
create policy nextgen_files_select
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'nextgen-files'
    and (
      public.is_admin()
      or owner = auth.uid()
      or (
        (storage.foldername(name))[1] = 'user'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
    )
  );

drop policy if exists nextgen_files_insert on storage.objects;
create policy nextgen_files_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'nextgen-files'
    and (
      (
        (storage.foldername(name))[1] = 'user'
        and (storage.foldername(name))[2] = auth.uid()::text
      )
      or (
        (storage.foldername(name))[1] = 'admin'
        and public.is_admin()
      )
    )
  );

drop policy if exists nextgen_files_update on storage.objects;
create policy nextgen_files_update
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'nextgen-files'
    and (
      public.is_admin()
      or (storage.foldername(name))[2] = auth.uid()::text
    )
  )
  with check (
    bucket_id = 'nextgen-files'
    and (
      public.is_admin()
      or (storage.foldername(name))[2] = auth.uid()::text
    )
  );

drop policy if exists nextgen_files_delete on storage.objects;
create policy nextgen_files_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'nextgen-files'
    and (
      public.is_admin()
      or owner = auth.uid()
      or (storage.foldername(name))[2] = auth.uid()::text
    )
  );

-- Event banners are world readable because event cards render them with a
-- plain <img>, but only administrators may upload or remove them.
drop policy if exists nextgen_banners_select on storage.objects;
create policy nextgen_banners_select
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'nextgen-event-banners');

drop policy if exists nextgen_banners_insert on storage.objects;
create policy nextgen_banners_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'nextgen-event-banners'
    and public.is_admin()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists nextgen_banners_update on storage.objects;
create policy nextgen_banners_update
  on storage.objects for update
  to authenticated
  using (bucket_id = 'nextgen-event-banners' and public.is_admin())
  with check (bucket_id = 'nextgen-event-banners' and public.is_admin());

drop policy if exists nextgen_banners_delete on storage.objects;
create policy nextgen_banners_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'nextgen-event-banners'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );
