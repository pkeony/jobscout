-- Phase 2B — 사용자 데이터 테이블 (캐시-first 전략)
-- 목적: localStorage 7 모듈 dual-write 대상. entry_id 는 localStorage 의 genId() 와 동일한 text 값.
-- RLS 는 모두 user_id = auth.uid() 기준.

-- ─────────────────────────────────────────
-- profiles: 활성 프로필 id 컬럼 추가
-- ─────────────────────────────────────────
alter table public.profiles
  add column if not exists active_profile_id text;

-- ─────────────────────────────────────────
-- user_profiles — ProfileSlot 대응. payload 에 전체 슬롯 저장
-- ─────────────────────────────────────────
create table if not exists public.user_profiles (
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, entry_id)
);

create index if not exists user_profiles_user_idx on public.user_profiles(user_id);

alter table public.user_profiles enable row level security;

create policy "user_profiles_owner_all"
  on public.user_profiles for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop trigger if exists touch_user_profiles_updated_at on public.user_profiles;
create trigger touch_user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────
-- jobs — Job 마스터. djb2 해시 id 유지. PK (user_id, id) 복합
-- ─────────────────────────────────────────
create table if not exists public.jobs (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  jd_text text not null,
  job_title text,
  company_name text,
  focus_position text,
  job_url text,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.jobs enable row level security;

create policy "jobs_owner_all"
  on public.jobs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─────────────────────────────────────────
-- 4 히스토리 — entry_id text 로 localStorage 와 매핑, payload jsonb 에 전체 entry 보관
-- ─────────────────────────────────────────
create table if not exists public.analyze_results (
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id text not null,
  job_id text not null,
  payload jsonb not null,
  saved_at timestamptz not null default now(),
  primary key (user_id, entry_id),
  foreign key (user_id, job_id) references public.jobs(user_id, id) on delete cascade
);

create index if not exists analyze_results_user_job_idx on public.analyze_results(user_id, job_id);
create index if not exists analyze_results_user_saved_idx on public.analyze_results(user_id, saved_at desc);

alter table public.analyze_results enable row level security;

create policy "analyze_results_owner_all"
  on public.analyze_results for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists public.match_results (
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id text not null,
  job_id text not null,
  payload jsonb not null,
  saved_at timestamptz not null default now(),
  primary key (user_id, entry_id),
  foreign key (user_id, job_id) references public.jobs(user_id, id) on delete cascade
);

create index if not exists match_results_user_job_idx on public.match_results(user_id, job_id);
create index if not exists match_results_user_saved_idx on public.match_results(user_id, saved_at desc);

alter table public.match_results enable row level security;

create policy "match_results_owner_all"
  on public.match_results for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists public.cover_letters (
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id text not null,
  job_id text not null,
  payload jsonb not null,
  saved_at timestamptz not null default now(),
  primary key (user_id, entry_id),
  foreign key (user_id, job_id) references public.jobs(user_id, id) on delete cascade
);

create index if not exists cover_letters_user_job_idx on public.cover_letters(user_id, job_id);
create index if not exists cover_letters_user_saved_idx on public.cover_letters(user_id, saved_at desc);

alter table public.cover_letters enable row level security;

create policy "cover_letters_owner_all"
  on public.cover_letters for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists public.interviews (
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id text not null,
  job_id text not null,
  payload jsonb not null,
  saved_at timestamptz not null default now(),
  primary key (user_id, entry_id),
  foreign key (user_id, job_id) references public.jobs(user_id, id) on delete cascade
);

create index if not exists interviews_user_job_idx on public.interviews(user_id, job_id);
create index if not exists interviews_user_saved_idx on public.interviews(user_id, saved_at desc);

alter table public.interviews enable row level security;

create policy "interviews_owner_all"
  on public.interviews for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─────────────────────────────────────────
-- job_meta — 유저×공고 1:1 상태/메모/마감일
-- ─────────────────────────────────────────
create table if not exists public.job_meta (
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id text not null,
  status text not null default 'explore',
  notes text not null default '',
  deadline date,
  updated_at timestamptz not null default now(),
  primary key (user_id, job_id),
  foreign key (user_id, job_id) references public.jobs(user_id, id) on delete cascade
);

alter table public.job_meta enable row level security;

create policy "job_meta_owner_all"
  on public.job_meta for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop trigger if exists touch_job_meta_updated_at on public.job_meta;
create trigger touch_job_meta_updated_at
  before update on public.job_meta
  for each row execute function public.touch_updated_at();
