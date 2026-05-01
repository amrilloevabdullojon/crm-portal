create table if not exists public.integration_settings (
  key text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_by_user_id bigint references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists integration_settings_updated_at_idx
  on public.integration_settings (updated_at desc);
