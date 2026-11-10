-- Rode inteiro no SQL Editor do Supabase.
create extension if not exists pgcrypto;

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  ig_user_id text not null,
  access_token text not null,
  created_at timestamptz default now()
);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  type text not null check (type in ('feed','carousel','reel','story')),
  caption text default '',
  title text default '',
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('draft','scheduled','processing','published','failed')),
  container_id text,
  child_ids jsonb,
  ig_media_id text,
  permalink text,
  error text,
  cover_url text,
  share_to_feed boolean default true,
  attempts int default 0,
  published_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists posts_due on posts (status, scheduled_at);

create table if not exists post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  position int not null default 0,
  url text not null,
  kind text not null check (kind in ('image','video'))
);

create table if not exists account_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  day date not null,
  followers int, media_count int,
  reach int, views int, profile_views int, website_clicks int,
  unique (account_id, day)
);

create table if not exists post_insights (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  fetched_at timestamptz default now(),
  views int, reach int, likes int, comments int, saves int, shares int
);
create index if not exists post_insights_post on post_insights (post_id, fetched_at desc);

create table if not exists publish_logs (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  at timestamptz default now(),
  step text, ok boolean, detail text
);

-- RLS: cada linha pertence ao dono
alter table accounts enable row level security;
alter table posts enable row level security;
alter table post_media enable row level security;
alter table account_snapshots enable row level security;
alter table post_insights enable row level security;
alter table publish_logs enable row level security;

create policy "own accounts" on accounts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own posts" on posts for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own media" on post_media for all
  using (exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid()))
  with check (exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid()));
create policy "own snaps" on account_snapshots for select
  using (exists (select 1 from accounts a where a.id = account_id and a.user_id = auth.uid()));
create policy "own insights" on post_insights for select
  using (exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid()));
create policy "own logs" on publish_logs for select
  using (exists (select 1 from posts p where p.id = post_id and p.user_id = auth.uid()));

-- Storage: bucket público (o Instagram precisa baixar por URL)
insert into storage.buckets (id, name, public) values ('media','media', true) on conflict (id) do nothing;
create policy "media read" on storage.objects for select using (bucket_id = 'media');
create policy "media insert" on storage.objects for insert to authenticated with check (bucket_id = 'media');
create policy "media update" on storage.objects for update to authenticated using (bucket_id = 'media');
create policy "media delete" on storage.objects for delete to authenticated using (bucket_id = 'media');

-- v2: histórico do que já está publicado no Instagram (importado pela API)
create table if not exists ig_media (
  ig_media_id text primary key,
  account_id uuid not null references accounts(id) on delete cascade,
  caption text, media_type text, product_type text,
  permalink text, posted_at timestamptz, synced_at timestamptz default now()
);
alter table ig_media enable row level security;
create policy "own ig_media" on ig_media for select
  using (exists (select 1 from accounts a where a.id = account_id and a.user_id = auth.uid()));
