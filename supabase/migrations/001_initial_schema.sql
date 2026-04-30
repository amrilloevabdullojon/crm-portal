create table public.users (
  id bigint generated always as identity primary key,
  auth_user_id uuid unique,
  name text not null,
  phone text unique,
  email text unique,
  role text not null check (role in ('client', 'manager', 'admin')),
  telegram_chat_id text unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clinics (
  id bigint generated always as identity primary key,
  name text not null,
  amo_deal_id bigint unique,
  status text not null default 'data_collection',
  drive_folder_url text,
  sla_started_at timestamptz,
  manager_user_id bigint references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clinic_users (
  id bigint generated always as identity primary key,
  clinic_id bigint not null references public.clinics(id) on delete cascade,
  user_id bigint not null references public.users(id) on delete cascade,
  clinic_role text not null default 'member',
  created_at timestamptz not null default now(),
  unique (clinic_id, user_id)
);

create table public.module_templates (
  id bigint generated always as identity primary key,
  name text not null unique,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create table public.clinic_modules (
  id bigint generated always as identity primary key,
  clinic_id bigint not null references public.clinics(id) on delete cascade,
  template_id bigint references public.module_templates(id),
  name text not null,
  status text not null default 'collection' check (
    status in ('collection', 'review', 'needs_revision', 'accepted')
  ),
  manager_comment text,
  accepted_at timestamptz,
  accepted_by_user_id bigint references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, name)
);

create table public.uploaded_files (
  id bigint generated always as identity primary key,
  clinic_id bigint not null references public.clinics(id) on delete cascade,
  module_id bigint not null references public.clinic_modules(id) on delete cascade,
  uploaded_by_user_id bigint references public.users(id),
  file_name text not null,
  mime_type text,
  file_size_bytes bigint,
  storage_provider text not null default 'google_drive' check (storage_provider = 'google_drive'),
  storage_file_id text,
  file_url text not null,
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.activity_log (
  id bigint generated always as identity primary key,
  actor_user_id bigint references public.users(id),
  clinic_id bigint references public.clinics(id) on delete set null,
  module_id bigint references public.clinic_modules(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.integration_events (
  id bigint generated always as identity primary key,
  provider text not null check (provider in ('amo', 'telegram', 'slack', 'google_drive')),
  external_id text,
  event_type text,
  payload jsonb not null,
  status text not null default 'received' check (status in ('received', 'processed', 'failed', 'ignored')),
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index users_role_idx on public.users (role);
create index users_auth_user_id_idx on public.users (auth_user_id);
create index clinics_status_idx on public.clinics (status);
create index clinics_manager_user_id_idx on public.clinics (manager_user_id);
create index clinic_users_clinic_id_idx on public.clinic_users (clinic_id);
create index clinic_users_user_id_idx on public.clinic_users (user_id);
create index clinic_modules_clinic_id_idx on public.clinic_modules (clinic_id);
create index clinic_modules_status_idx on public.clinic_modules (status);
create index clinic_modules_template_id_idx on public.clinic_modules (template_id);
create index uploaded_files_clinic_id_idx on public.uploaded_files (clinic_id);
create index uploaded_files_module_id_idx on public.uploaded_files (module_id);
create index uploaded_files_uploaded_by_user_id_idx on public.uploaded_files (uploaded_by_user_id);
create index uploaded_files_current_idx on public.uploaded_files (module_id) where is_current = true;
create index activity_log_actor_user_id_idx on public.activity_log (actor_user_id);
create index activity_log_clinic_id_idx on public.activity_log (clinic_id);
create index activity_log_module_id_idx on public.activity_log (module_id);
create index activity_log_created_at_idx on public.activity_log (created_at desc);
create index integration_events_provider_created_at_idx on public.integration_events (provider, created_at desc);
create unique index integration_events_provider_external_id_idx
  on public.integration_events (provider, external_id)
  where external_id is not null;
