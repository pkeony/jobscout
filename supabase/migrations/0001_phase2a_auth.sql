-- Phase 2A — 인증 뼈대
-- 목적: auth.users 에 앱 레벨 메타(profiles) 를 1:1 로 붙이고 RLS 로 격리.
-- Phase 2B 에서 user_profiles / jobs / histories / job_meta 추가
-- Phase 2C 에서 subscriptions / credits / payments 및 consume_credit SP 추가

-- ─────────────────────────────────────────
-- profiles — auth.users 1:1 확장
-- ─────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  onboarded_at timestamptz,
  migrated_local_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_self_select"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_self_update"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- insert 는 트리거가 service role 로 수행. 일반 클라이언트 insert 는 막는다.

-- ─────────────────────────────────────────
-- auth.users 가입 시 profiles row 자동 생성
-- ─────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────
-- updated_at 자동 갱신
-- ─────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_profiles_updated_at on public.profiles;
create trigger touch_profiles_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();
