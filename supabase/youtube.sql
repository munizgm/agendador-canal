-- YouTube — rode inteiro no SQL Editor do Supabase.
-- Só CRIA tabelas novas. Não altera nada do Instagram.
create extension if not exists pgcrypto;

create table if not exists yt_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null default 'Meu canal',
  channel_url text,
  -- horários diários de postagem (Brasília), editáveis na aba Conta
  slots jsonb not null default '["08:00","09:00","10:00","12:00","13:30","15:00","17:00","18:00","19:00","21:00"]'::jsonb,
  category_id text not null default '22',
  created_at timestamptz default now()
);

create table if not exists yt_videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid references yt_accounts(id) on delete set null,
  title text not null,
  description text default '',
  tags text default '',
  video_url text not null,
  file_name text,
  publish_at timestamptz not null,
  status text not null default 'queued' check (status in ('draft','queued','uploading','scheduled','published','failed')),
  youtube_video_id text,
  error text,
  claimed_at timestamptz,
  uploaded_at timestamptz,
  published_at timestamptz,
  views int default 0, likes int default 0, comments int default 0,
  metrics_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists yt_videos_due on yt_videos (status, publish_at);

create table if not exists yt_metrics (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references yt_videos(id) on delete cascade,
  fetched_at timestamptz default now(),
  views int, likes int, comments int
);
create index if not exists yt_metrics_video on yt_metrics (video_id, fetched_at desc);

alter table yt_accounts enable row level security;
alter table yt_videos  enable row level security;
alter table yt_metrics enable row level security;

drop policy if exists "own yt_accounts" on yt_accounts;
create policy "own yt_accounts" on yt_accounts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own yt_videos" on yt_videos;
create policy "own yt_videos" on yt_videos for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own yt_metrics" on yt_metrics;
create policy "own yt_metrics" on yt_metrics for all
  using (exists (select 1 from yt_videos v where v.id = video_id and v.user_id = auth.uid()))
  with check (exists (select 1 from yt_videos v where v.id = video_id and v.user_id = auth.uid()));
