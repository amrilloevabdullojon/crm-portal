create extension if not exists pgcrypto;

create table public.auth_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id bigint not null references public.users(id) on delete cascade,
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index auth_challenges_user_id_idx on public.auth_challenges (user_id);
create index auth_challenges_phone_created_at_idx on public.auth_challenges (phone, created_at desc);
create index auth_challenges_expires_at_idx on public.auth_challenges (expires_at);
