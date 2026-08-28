-- Sales Copilot 数据库结构 v4.1 修复版（幂等，可重复执行）
-- 修复 P0-1: 补 vector 扩展 + 去重建表

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ============ clients 表 ============
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  company text,
  title text,
  industry text,
  note text,
  stage text default 'lead' check (stage in ('lead','touched','proposal','negotiation','won','lost')),
  status text default 'generating' check (status in ('generating','ready','failed')),
  profile jsonb,
  next_follow_up timestamptz,
  created_at timestamptz default now()
);
create index if not exists idx_clients_user on public.clients(user_id);
create index if not exists idx_clients_user_created on public.clients(user_id, created_at desc);

-- ============ interactions 表 ============
create table if not exists public.interactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  type text not null check (type in ('call','wechat','meeting','email','other')),
  summary text,
  commitments jsonb,
  objections jsonb,
  next_step text,
  next_step_time timestamptz,
  raw_content text,
  created_at timestamptz default now()
);
create index if not exists idx_interactions_client on public.interactions(client_id);
create index if not exists idx_interactions_client_time on public.interactions(client_id, created_at desc);
alter table public.interactions add column if not exists raw_content text;

-- ============ knowledge_docs：全局共享知识库 ============
create table if not exists public.knowledge_docs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null default 'other' check (category in ('objection','faq','competitor','case','script','other')),
  content text not null,
  embedding vector(1536),
  created_at timestamptz default now()
);
create index if not exists idx_knowledge_user on public.knowledge_docs(user_id);
create index if not exists idx_knowledge_user_cat on public.knowledge_docs(user_id, category);
create index if not exists idx_knowledge_used_count on public.knowledge_docs(used_count desc);

-- v8 新增：知识库生态字段
alter table public.knowledge_docs add column if not exists industry_tags text[] default '{}';
alter table public.knowledge_docs add column if not exists used_count int not null default 0;

-- 向量化索引（数据量大时加速检索，小库无影响）
-- 注意：需有数据后才能建 ivfflat，首次执行若失败可忽略，数据量>100后再建
-- create index if not exists idx_knowledge_embedding on public.knowledge_docs using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ============ app_settings 运行时配置表 ============
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);
alter table public.app_settings enable row level security;
-- 无 policy = 仅 service_role 可读写（前端 anon key 无法触碰），安全

-- ============ RLS 策略 ============
alter table public.clients enable row level security;
alter table public.interactions enable row level security;
alter table public.knowledge_docs enable row level security;

-- 客户表
drop policy if exists "clients_select_own" on public.clients;
drop policy if exists "clients_insert_own" on public.clients;
drop policy if exists "clients_update_own" on public.clients;
drop policy if exists "clients_delete_own" on public.clients;
create policy "clients_select_own" on public.clients for select using (auth.uid() = user_id);
create policy "clients_insert_own" on public.clients for insert with check (auth.uid() = user_id);
create policy "clients_update_own" on public.clients for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "clients_delete_own" on public.clients for delete using (auth.uid() = user_id);

-- 交互表
drop policy if exists "interactions_select_own" on public.interactions;
drop policy if exists "interactions_insert_own" on public.interactions;
drop policy if exists "interactions_update_own" on public.interactions;
drop policy if exists "interactions_delete_own" on public.interactions;
create policy "interactions_select_own" on public.interactions for select using (exists (select 1 from public.clients c where c.id = client_id and auth.uid() = c.user_id));
create policy "interactions_insert_own" on public.interactions for insert with check (exists (select 1 from public.clients c where c.id = client_id and auth.uid() = c.user_id));
create policy "interactions_update_own" on public.interactions for update using (exists (select 1 from public.clients c where c.id = client_id and auth.uid() = c.user_id));
create policy "interactions_delete_own" on public.interactions for delete using (exists (select 1 from public.clients c where c.id = client_id and auth.uid() = c.user_id));

-- 知识库：全局共享读，写删仅贡献者本人
drop policy if exists "knowledge_select_own" on public.knowledge_docs;
drop policy if exists "knowledge_select_all" on public.knowledge_docs;
drop policy if exists "knowledge_insert_own" on public.knowledge_docs;
drop policy if exists "knowledge_update_own" on public.knowledge_docs;
drop policy if exists "knowledge_delete_own" on public.knowledge_docs;
create policy "knowledge_select_all" on public.knowledge_docs for select to authenticated using (true);
create policy "knowledge_insert_own" on public.knowledge_docs for insert to authenticated with check (auth.uid() = user_id);
create policy "knowledge_update_own" on public.knowledge_docs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "knowledge_delete_own" on public.knowledge_docs for delete to authenticated using (auth.uid() = user_id);
