-- Phase 2C — 크레딧 + 구독 + 결제 (토스페이먼츠)
-- 목적: 선차감 크레딧 가드, 빌링키 기반 월 구독, 단건 충전팩.
-- 정책: 모든 write 는 service role 전용. RLS 는 owner SELECT 만 허용.

-- ─────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────
do $$ begin
  create type public.plan_tier as enum ('free', 'pro', 'plus');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_status as enum ('active', 'canceled', 'past_due');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_type as enum ('subscription', 'credit_topup');
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────
-- subscriptions — 유저당 1행. Free 도 row 존재
-- ─────────────────────────────────────────
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan plan_tier not null default 'free',
  status subscription_status not null default 'active',
  toss_billing_key text,
  toss_customer_key text not null unique,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default (now() + interval '30 days'),
  cancel_at_period_end boolean not null default false,
  failed_charge_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_self_select" on public.subscriptions;
create policy "subscriptions_self_select"
  on public.subscriptions for select
  using (user_id = auth.uid());

drop trigger if exists touch_subscriptions_updated_at on public.subscriptions;
create trigger touch_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────
-- credit_balances — 유저당 1행
-- ─────────────────────────────────────────
create table if not exists public.credit_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  remaining int not null default 0 check (remaining >= 0),
  renewed_at timestamptz not null default now(),
  plan_granted_this_cycle int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.credit_balances enable row level security;

drop policy if exists "credit_balances_self_select" on public.credit_balances;
create policy "credit_balances_self_select"
  on public.credit_balances for select
  using (user_id = auth.uid());

drop trigger if exists touch_credit_balances_updated_at on public.credit_balances;
create trigger touch_credit_balances_updated_at
  before update on public.credit_balances
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────
-- credit_transactions — 원장. 음수=차감, 양수=지급/환불
-- ─────────────────────────────────────────
create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta int not null,
  reason text not null,
  ref_id text,
  created_at timestamptz not null default now()
);

create index if not exists credit_transactions_user_created_idx
  on public.credit_transactions(user_id, created_at desc);

-- (ref_id, reason) 멱등 제약 — payment_key 기반 중복 지급 방지.
-- ref_id IS NULL (cron monthly_grant 등) 은 제약 대상 제외.
create unique index if not exists credit_transactions_ref_reason_unique
  on public.credit_transactions(ref_id, reason)
  where ref_id is not null;

alter table public.credit_transactions enable row level security;

drop policy if exists "credit_transactions_self_select" on public.credit_transactions;
create policy "credit_transactions_self_select"
  on public.credit_transactions for select
  using (user_id = auth.uid());

-- ─────────────────────────────────────────
-- payments — 토스 결제 원장. payment_key PK = 멱등성 키
-- ─────────────────────────────────────────
create table if not exists public.payments (
  payment_key text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type payment_type not null,
  plan plan_tier,
  credit_amount int,
  amount int not null,
  status text not null,
  order_id text,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists payments_user_created_idx
  on public.payments(user_id, created_at desc);

create unique index if not exists payments_order_id_unique
  on public.payments(order_id)
  where order_id is not null;

alter table public.payments enable row level security;

drop policy if exists "payments_self_select" on public.payments;
create policy "payments_self_select"
  on public.payments for select
  using (user_id = auth.uid());

-- ─────────────────────────────────────────
-- consume_credit — 원자적 차감 + 트랜잭션 기록
--   return: 'ok' | 'insufficient'
--   security definer 로 RLS 우회. revoke 로 일반 호출 차단 → service role 만 호출
-- ─────────────────────────────────────────
create or replace function public.consume_credit(
  p_user_id uuid,
  p_amount int,
  p_reason text,
  p_ref_id text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
begin
  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  select remaining into v_balance
  from public.credit_balances
  where user_id = p_user_id
  for update;

  if v_balance is null or v_balance < p_amount then
    return 'insufficient';
  end if;

  update public.credit_balances
  set remaining = remaining - p_amount
  where user_id = p_user_id;

  insert into public.credit_transactions (user_id, delta, reason, ref_id)
  values (p_user_id, -p_amount, p_reason, p_ref_id);

  return 'ok';
end;
$$;

revoke execute on function public.consume_credit(uuid, int, text, text) from public, anon, authenticated;

-- ─────────────────────────────────────────
-- grant_credits — 원자적 지급 (월 grant / 충전팩 / refund)
-- DROP 선행 — returns 타입 변경 시 CREATE OR REPLACE 로 못 덮어쓰므로 멱등성 보장
-- ─────────────────────────────────────────
drop function if exists public.grant_credits(uuid, int, text, text);

create or replace function public.grant_credits(
  p_user_id uuid,
  p_amount int,
  p_reason text,
  p_ref_id text default null
)
returns boolean  -- true=지급됨, false=중복(ref_id 기반 이미 지급)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx_id uuid;
begin
  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  -- 1) 멱등 기록 — (ref_id, reason) 중복이면 tx 미생성
  insert into public.credit_transactions (user_id, delta, reason, ref_id)
  values (p_user_id, p_amount, p_reason, p_ref_id)
  on conflict (ref_id, reason) where ref_id is not null do nothing
  returning id into v_tx_id;

  -- ref_id 기반 중복 감지 — balance 도 건드리지 않음
  if p_ref_id is not null and v_tx_id is null then
    return false;
  end if;

  -- 2) balance 반영 (ref_id null 은 항상 지급)
  insert into public.credit_balances (user_id, remaining, renewed_at, plan_granted_this_cycle)
  values (p_user_id, p_amount, now(), case when p_reason = 'monthly_grant' then p_amount else 0 end)
  on conflict (user_id) do update
  set remaining = public.credit_balances.remaining + p_amount,
      renewed_at = case when p_reason = 'monthly_grant' then now() else public.credit_balances.renewed_at end,
      plan_granted_this_cycle = case when p_reason = 'monthly_grant' then p_amount else public.credit_balances.plan_granted_this_cycle end;

  return true;
end;
$$;

revoke execute on function public.grant_credits(uuid, int, text, text) from public, anon, authenticated;

-- ─────────────────────────────────────────
-- grant_monthly_if_due — race-free 월 크레딧 지급
--   SELECT ... FOR UPDATE 로 subscription+balance 행 잠금 → 동시 요청 이중 지급 방지
--   return: 지급된 크레딧 수 (0 = 미지급)
-- ─────────────────────────────────────────
drop function if exists public.grant_monthly_if_due(uuid);

create or replace function public.grant_monthly_if_due(p_user_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan plan_tier;
  v_status subscription_status;
  v_amount int;
  v_renewed_at timestamptz;
begin
  -- 구독 잠금
  select plan, status into v_plan, v_status
  from public.subscriptions
  where user_id = p_user_id
  for update;

  if v_plan is null or v_status <> 'active' then
    return 0;
  end if;

  v_amount := case v_plan
    when 'free' then 5
    when 'pro' then 100
    when 'plus' then 400
    else 0
  end;
  if v_amount = 0 then
    return 0;
  end if;

  -- 잔고 잠금 (없으면 기본값으로 간주해서 지급)
  select renewed_at into v_renewed_at
  from public.credit_balances
  where user_id = p_user_id
  for update;

  if v_renewed_at is not null and v_renewed_at > now() - interval '30 days' then
    return 0;
  end if;

  insert into public.credit_balances (user_id, remaining, renewed_at, plan_granted_this_cycle)
  values (p_user_id, v_amount, now(), v_amount)
  on conflict (user_id) do update
  set remaining = public.credit_balances.remaining + v_amount,
      renewed_at = now(),
      plan_granted_this_cycle = v_amount;

  insert into public.credit_transactions (user_id, delta, reason)
  values (p_user_id, v_amount, 'monthly_grant');

  return v_amount;
end;
$$;

revoke execute on function public.grant_monthly_if_due(uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────
-- 회원가입 시 subscriptions (free) + credit_balances (5) 자동 생성
-- 0001 의 handle_new_user (profiles) 와 별개 트리거. 알파벳 순으로 profiles 먼저 실행
-- ─────────────────────────────────────────
create or replace function public.handle_new_user_billing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.subscriptions (
    user_id, plan, status, toss_customer_key,
    current_period_start, current_period_end
  )
  values (
    new.id, 'free', 'active', new.id::text,
    now(), now() + interval '30 days'
  )
  on conflict (user_id) do nothing;

  insert into public.credit_balances (user_id, remaining, renewed_at, plan_granted_this_cycle)
  values (new.id, 5, now(), 5)
  on conflict (user_id) do nothing;

  insert into public.credit_transactions (user_id, delta, reason)
  values (new.id, 5, 'monthly_grant');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_billing on auth.users;
create trigger on_auth_user_created_billing
  after insert on auth.users
  for each row execute function public.handle_new_user_billing();
