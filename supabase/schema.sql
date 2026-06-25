-- Supabase schema for Quant Tracker
-- Run this file in the Supabase SQL Editor for your project.

create extension if not exists pgcrypto;

-- ============================================================
--  Role helpers
-- ============================================================
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select coalesce((select role from public.profiles where id = auth.uid()), 'user');
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.current_user_role() in ('admin', 'owner');
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.current_user_role() = 'owner';
$$;

-- Allows username login without exposing broader profile access.
create or replace function public.get_email_for_username(input_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
    select email from public.profiles where lower(username) = lower(input_username) and is_active = true limit 1;
$$;

-- ============================================================
--  Tables
-- ============================================================
create table if not exists public.profiles (
    id uuid references auth.users(id) on delete cascade primary key,
    username text unique not null,
    full_name text,
    email text unique not null,
    role text default 'user' check (role in ('user', 'admin', 'owner')),
    avatar_url text,
    bio text,
    phone text,
    is_active boolean default true,
    last_login timestamptz,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table if not exists public.user_activities (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade,
    action text not null,
    ip_address text,
    user_agent text,
    created_at timestamptz default now()
);

create table if not exists public.content (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.profiles(id) on delete cascade,
    title text not null,
    content text,
    status text default 'pending' check (status in ('pending', 'approved', 'rejected', 'draft')),
    type text check (type in ('post', 'comment', 'resource', 'announcement')),
    is_published boolean default false,
    published_at timestamptz,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table if not exists public.system_settings (
    id uuid default gen_random_uuid() primary key,
    setting_key text unique not null,
    setting_value jsonb,
    description text,
    updated_by uuid references public.profiles(id),
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table if not exists public.admin_logs (
    id uuid default gen_random_uuid() primary key,
    admin_id uuid references public.profiles(id),
    action_type text not null,
    target_user_id uuid references public.profiles(id),
    target_content_id uuid references public.content(id),
    description text,
    ip_address text,
    created_at timestamptz default now()
);

-- Persists the existing Quant Tracker local app state per authenticated user.
create table if not exists public.user_app_states (
    user_id uuid references public.profiles(id) on delete cascade primary key,
    state jsonb not null default '{}'::jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_active on public.profiles(is_active);
create index if not exists idx_content_user_id on public.content(user_id);
create index if not exists idx_content_status on public.content(status);
create index if not exists idx_content_published on public.content(is_published, published_at desc);
create index if not exists idx_user_activities_user_id on public.user_activities(user_id, created_at desc);
create index if not exists idx_admin_logs_admin_id on public.admin_logs(admin_id, created_at desc);

-- ============================================================
--  Updated-at trigger
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_content_updated_at on public.content;
create trigger set_content_updated_at before update on public.content
for each row execute function public.set_updated_at();

drop trigger if exists set_system_settings_updated_at on public.system_settings;
create trigger set_system_settings_updated_at before update on public.system_settings
for each row execute function public.set_updated_at();

drop trigger if exists set_user_app_states_updated_at on public.user_app_states;
create trigger set_user_app_states_updated_at before update on public.user_app_states
for each row execute function public.set_updated_at();

-- Creates a profile automatically after Supabase Auth signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    requested_username text;
begin
    requested_username := nullif(trim(new.raw_user_meta_data->>'username'), '');

    insert into public.profiles (id, username, full_name, email, role)
    values (
        new.id,
        coalesce(requested_username, split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 8)),
        nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
        new.email,
        'user'
    )
    on conflict (id) do update set
        email = excluded.email,
        username = excluded.username,
        updated_at = now();

    insert into public.user_app_states (user_id, state)
    values (new.id, '{}'::jsonb)
    on conflict (user_id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============================================================
--  Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.user_activities enable row level security;
alter table public.content enable row level security;
alter table public.system_settings enable row level security;
alter table public.admin_logs enable row level security;
alter table public.user_app_states enable row level security;

-- Profiles
create policy "profiles_select_own_admin_owner" on public.profiles
for select using (id = auth.uid() or public.is_admin());

create policy "profiles_insert_own" on public.profiles
for insert with check (id = auth.uid());

create policy "profiles_update_own_non_role" on public.profiles
for update using (id = auth.uid())
with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

create policy "profiles_admin_update_users" on public.profiles
for update using (public.is_admin() and role = 'user')
with check (public.is_admin() and role = 'user');

create policy "profiles_owner_full_control" on public.profiles
for all using (public.is_owner()) with check (public.is_owner());

-- User activities
create policy "activities_insert_own" on public.user_activities
for insert with check (user_id = auth.uid());

create policy "activities_select_own_or_admin" on public.user_activities
for select using (user_id = auth.uid() or public.is_admin());

create policy "activities_owner_delete" on public.user_activities
for delete using (public.is_owner());

-- Content
create policy "content_public_read" on public.content
for select using (is_published = true and status = 'approved');

create policy "content_owner_read_own" on public.content
for select using (user_id = auth.uid());

create policy "content_admin_read_all" on public.content
for select using (public.is_admin());

create policy "content_insert_own" on public.content
for insert with check (user_id = auth.uid());

create policy "content_update_own_unpublished" on public.content
for update using (user_id = auth.uid() and status in ('pending', 'draft'))
with check (user_id = auth.uid() and status in ('pending', 'draft'));

create policy "content_admin_moderate" on public.content
for update using (public.is_admin()) with check (public.is_admin());

create policy "content_owner_delete_any" on public.content
for delete using (public.is_owner());

-- System settings
create policy "settings_select_authenticated" on public.system_settings
for select using (auth.uid() is not null);

create policy "settings_owner_write" on public.system_settings
for all using (public.is_owner()) with check (public.is_owner());

-- Admin logs
create policy "admin_logs_insert_admin" on public.admin_logs
for insert with check (admin_id = auth.uid() and public.is_admin());

create policy "admin_logs_select_admin" on public.admin_logs
for select using (public.is_admin());

create policy "admin_logs_owner_delete" on public.admin_logs
for delete using (public.is_owner());

-- User app state
create policy "app_states_select_own_or_admin" on public.user_app_states
for select using (user_id = auth.uid() or public.is_admin());

create policy "app_states_insert_own" on public.user_app_states
for insert with check (user_id = auth.uid());

create policy "app_states_update_own" on public.user_app_states
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "app_states_owner_delete" on public.user_app_states
for delete using (public.is_owner());

-- ============================================================
--  Seed defaults
-- ============================================================
insert into public.system_settings (setting_key, setting_value, description)
values
    ('freeMode', 'true'::jsonb, 'Enables all free-mode UI features'),
    ('devMode', 'true'::jsonb, 'Shows developer tools in the dashboard')
on conflict (setting_key) do nothing;

-- After creating your first account, promote it manually:
-- update public.profiles set role = 'owner' where email = 'your-email@example.com';
