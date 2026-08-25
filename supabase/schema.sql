-- Sales Copilot 数据库结构 v4（幂等，可重复执行）
-- v4: 知识库升级为全局共享模式——所有部署实例共享同一份实战知识

create extension if not exists "pgcrypto";

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

-- 老库增量迁移
alter table public.interactions add column if not exists raw_content text;

-- ============ knowledge_docs：全局共享知识库 ============
-- 设计变更: user_id 仅作贡献者溯源, RLS 对 SELECT 全开放
-- 任何人可读全部知识, 只有贡献者能改/删自己的条目
create table if not exists public.knowledge_docs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null default 'other' check (category in ('objection','faq','competitor','case','script','other')),
    -- objection=异议应对 faq=产品FAQ competitor=竞品对比 case=成功案例 script=标准话术
  content text not null,
  embedding vector(1536),
  created_at timestamptz default now()
);

create index if not exists idx_knowledge_user on public.knowledge_docs(user_id);
create index if not exists idx_knowledge_user_cat on public.knowledge_docs(user_id, category);

-- v3 增量迁移：老库补列（幂等）
alter table public.interactions add column if not exists raw_content text;

-- ============ v3 新增：knowledge_docs 话术知识库 ============
create table if not exists public.knowledge_docs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,                 -- 知识条目标题（如"价格异议应对话术"）
  category text not null default 'other' check (category in ('objection','faq','competitor','case','script','other')),
    -- objection=异议应对 faq=产品FAQ competitor=竞品对比 case=成功案例 script=标准话术
  content text not null,               -- 正文（Markdown）
  embedding vector(1536),              -- OpenAI text-embedding-3-small 维度
  created_at timestamptz default now()
);

create index if not exists idx_knowledge_user on public.knowledge_docs(user_id);
create index if not exists idx_knowledge_user_cat on public.knowledge_docs(user_id, category);

-- ============ v6 新增：app_settings 运行时配置表 ============
-- 存储网页端动态修改的 AI 接入配置（provider/apiKey/model）
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

alter table public.app_settings enable row level security;
drop policy if exists "app_settings_service_only" on public.app_settings;
-- 无 policy = 仅 service_role 可读写（前端 anon key 无法触碰），安全

-- ============ RLS 安全策略 ============
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
create policy "interactions_select_own" on public.interactions
  for select using (exists (select 1 from public.clients c where c.id = client_id and auth.uid() = c.user_id));
create policy "interactions_insert_own" on public.interactions
  for insert with check (exists (select 1 from public.clients c where c.id = client_id and auth.uid() = c.user_id));
create policy "interactions_update_own" on public.interactions
  for update using (exists (select 1 from public.clients c where c.id = client_id and auth.uid() = c.user_id));
create policy "interactions_delete_own" on public.interactions
  for delete using (exists (select 1 from public.clients c where c.id = client_id and auth.uid() = c.user_id));

-- 知识库表策略：全局共享——SELECT 对所有登录用户开放，写删仅限贡献者本人
drop policy if exists "knowledge_select_own" on public.knowledge_docs;
drop policy if exists "knowledge_insert_own" on public.knowledge_docs;
drop policy if exists "knowledge_update_own" on public.knowledge_docs;
drop policy if exists "knowledge_delete_own" on public.knowledge_docs;

create policy "knowledge_select_all" on public.knowledge_docs
  for select to authenticated using (true);
create policy "knowledge_insert_own" on public.knowledge_docs
  for insert to authenticated with check (auth.uid() = user_id);
create policy "knowledge_update_own" on public.knowledge_docs
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "knowledge_delete_own" on public.knowledge_docs
  for delete to authenticated using (auth.uid() = user_id);