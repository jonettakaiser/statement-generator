-- Statement Generator schema
-- Run this in the Supabase SQL editor (or via the CLI) against a fresh project.
-- Enable pgcrypto for gen_random_uuid() if not already on.
create extension if not exists pgcrypto;

create table if not exists production_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  primary_contact_email text,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null references auth.users (id) on delete cascade,
  email text,
  role text not null default 'client' check (role in ('admin', 'client')),
  production_company_id uuid references production_companies (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists films (
  film_id uuid primary key default gen_random_uuid(),
  title text not null,
  production_company_id uuid references production_companies (id) on delete set null,
  statement_contact_email text,
  created_at timestamptz not null default now()
);

create table if not exists program_splits (
  program_split_id uuid primary key default gen_random_uuid(),
  program_name text not null,
  program_name_normalized text not null unique,
  film_id uuid references films (film_id) on delete set null,
  split_profile text not null,
  program_type text not null default 'feature' check (program_type in ('feature', 'series')),
  season_name text,
  episode_name text,
  display_title_override text,
  created_at timestamptz not null default now()
);

create table if not exists statement_uploads (
  upload_id uuid primary key default gen_random_uuid(),
  file_name text not null,
  platform text not null,
  period_start date not null,
  period_end date not null,
  status text not null default 'processing' check (status in ('processing', 'assigning', 'complete')),
  total_gross numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists statements (
  statement_id uuid primary key default gen_random_uuid(),
  production_company_id uuid not null references production_companies (id) on delete cascade,
  label text not null,
  payment_month text,
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'final')),
  gross_total numeric(12, 2) not null default 0,
  distribution_fee_total numeric(12, 2) not null default 0,
  net_to_client_total numeric(12, 2) not null default 0,
  visible_to_client boolean not null default false,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists row_assignments (
  assignment_id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references statement_uploads (upload_id) on delete cascade,
  source_row_index int not null,
  program_name text not null,
  csv_episode text,
  film_id uuid references films (film_id) on delete set null,
  platform text not null,
  payment_month text,
  split_profile text,
  program_type text not null default 'feature' check (program_type in ('feature', 'series')),
  season_name text,
  episode_name text,
  display_title_override text,
  gross_earned numeric(12, 2) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'ready', 'statemented')),
  statement_id uuid references statements (statement_id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists statement_lines (
  line_id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references statements (statement_id) on delete cascade,
  program_name text not null,
  platform text not null,
  gross numeric(12, 2) not null default 0,
  client_share_pct numeric(4, 3) not null,
  distributor_share_pct numeric(4, 3) not null,
  distribution_fee numeric(12, 2) not null,
  net_to_client numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_row_assignments_upload on row_assignments (upload_id);
create index if not exists idx_row_assignments_statement on row_assignments (statement_id);
create index if not exists idx_statement_lines_statement on statement_lines (statement_id);
create index if not exists idx_statements_company on statements (production_company_id);

-- Row Level Security: service-role key (used by API routes) bypasses RLS.
-- These policies only govern direct client-side access via the anon key.
alter table production_companies enable row level security;
alter table users enable row level security;
alter table films enable row level security;
alter table program_splits enable row level security;
alter table statement_uploads enable row level security;
alter table statements enable row level security;
alter table row_assignments enable row level security;
alter table statement_lines enable row level security;

create policy "users read own row" on users
  for select using (auth_user_id = auth.uid());

create policy "clients read own visible statements" on statements
  for select using (
    visible_to_client = true
    and production_company_id in (
      select production_company_id from users where auth_user_id = auth.uid()
    )
  );

create policy "clients read own statement lines" on statement_lines
  for select using (
    statement_id in (
      select statement_id from statements
      where visible_to_client = true
        and production_company_id in (
          select production_company_id from users where auth_user_id = auth.uid()
        )
    )
  );
