-- Sales Copilot 数据库结构
-- 在 Supabase SQL Editor 中执行

create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  title text,
  industry text,
  note text,
  stage text default 'lead',        -- lead/touched/proposal/negotiation/won/lost
  profile jsonb,                    -- 情报官生成的报告（Markdown）
  next_follow_up timestamptz,
  created_at timestamptz default now()
);

create table interactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  type text not null,               -- call/wechat/meeting
  summary text,
  commitments jsonb,                -- 客户承诺
  objections jsonb,                 -- 异议清单
  next_step text,
  next_step_time timestamptz,
  created_at timestamptz default now()
);

create index idx_clients_created on clients(created_at desc);
create index idx_interactions_client on interactions(client_id);