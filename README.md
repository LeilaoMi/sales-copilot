<div align="center">

# 🎯 销售情报官

**AI-Powered Sales Copilot · 开源自部署的销售作战系统**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase)](https://supabase.com/)
[![pgvector](https://img.shields.io/badge/pgvector-1536-blue)](https://github.com/pgvector/pgvector)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](./LICENSE)
[![Knowledge](https://img.shields.io/badge/Knowledge-10k-orange)](#-知识库--10000-条实战弹药)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/LeilaoMi/sales-copilot&env=LLM_PROVIDER,DEEPSEEK_API_KEY,NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY&project-name=sales-copilot)

*输入客户信息 → 联网搜集情报 → 30 秒生成作战简报 → 沉淀为可复用的团队知识资产*

[一键部署](#-快速开始) · [本地开发](#-本地开发) · [知识库](#-知识库--10000-条实战弹药) · [技术架构](#%EF%B8%8F-技术架构) · [API 一览](#-api-一览)

</div>

---

## 📋 目录

- [为什么做这个](#为什么做这个)
- [核心特性](#-核心特性)
- [知识库 · 10,000 条](#-知识库--10000-条实战弹药)
- [技术架构](#%EF%B8%8F-技术架构)
- [安全与检索设计](#-安全与检索设计)
- [目录结构](#-目录结构)
- [快速开始](#-快速开始)
- [环境变量](#-环境变量)
- [数据模型](#%EF%B8%8F-数据模型)
- [API 一览](#-api-一览)
- [加入知识共建](#-加入知识共建)
- [更新日志](#-更新日志)
- [致谢](#-致谢)

---

## 为什么做这个

销售每天真正花在「研究客户、复盘谈话、整理经验」上的时间，远比实际开单的多。这些重复劳动，正是 AI 该干的活。

销售情报官把一条完整的销售作战闭环搬进了网页，开箱即用，手机电脑都能跑：

```
 🕵️ 找线索    ──▶  输入客户信息，Tavily 双查询（公司+行业）联网搜集，LLM 综合生成结构化作战简报
 💬 谈完之后  ──▶  粘贴微信/电话聊天记录，AI 自动提取 摘要 / 承诺 / 异议 / 下一步 + 建议回复
 🔫 谈判卡壳  ──▶  输入客户原话，从 10k 社区知识库混合检索，生成定制应对话术
 ⏰ 忘性大    ──▶  跟进到期自动弹通知（浏览器 Notification + 轮询），过期未跟进重点标红
 📊 每周日晚  ──▶  AI 复盘本周数据：漏斗健康度、卡单分析、下周行动清单
 🧠 打完一仗  ──▶  一键把交互沉淀为脱敏的社区共享知识，越用越强，引用自动计数
```

> **定位**：自用优先的轻量 CRM + 情报官 + 军火库。单人开箱即用，团队共用同一份全局知识也能跑。

---

## ✨ 核心特性

| 模块 | 能力 | 要点 |
|---|---|---|
| **🎯 作战台** | 销售漏斗可视化 · 本周待跟进（未来 7 天） · 客户高频异议 TOP5 · 近 7 日交互趋势 · 核心指标 4 宫格 | 数据来自 `clients` + `interactions` 实时聚合，空状态有引导 |
| **🕵️ 情报官** | Tavily 双查询（`公司业务+新闻` / `行业趋势+痛点`）→ LLM 综合 → 简报 6 段式（背景/行业痛点 TOP3/角色关心/中文开场白/英文开场白/雷区）+ 情报来源防幻觉 | 无 `TAVILY_API_KEY` 自动降级为纯模型知识，明确标注“待核实” |
| **✨ 会话情报员** | 聊天原文（≤8000字）→ 结构化提取 `summary / commitments / objections / next_step / next_step_time / reply_suggestion` → 一键入库客户档案，同步回写 `next_follow_up` | 覆盖 `call / wechat / meeting / email / other`，`raw_content` 保留原文 |
| **🔫 话术军火** | 全局共享知识库 **10,000 条** + 混合检索（向量 50% + 中文 bigram 50%）+ LLM 定制 `analysis / talking_points / suggested_reply / follow_up` | 命中自动 `used_count +1`，支持行业标签过滤 |
| **📊 AI 周报** | 汇总 7 天新增客户/交互/成交/丢单/待跟进 + Top 异议，生成 5 段式周报（回顾/解读/风险/行动清单/一句话总结） | `maxDuration=300`，流式生成防超时 |
| **🏆 社区共建** | 知识全局共享 · `industry_tags` 行业标签 · `used_count` 热度 · 贡献者排行榜（按 `docs / used` 排序） | 标题含“客户原话特征”关键词命中率最高 |
| **⚙️ 动态接模** | 网页端 ⚙️ 随时切换 DeepSeek / 智谱 / 通义 / Agnes / OpenAI / 任意 OpenAI 兼容接口，支持拉取模型列表、测试连接、历史 10 条一键切回 | 配置存 `app_settings`，运行时下发，无需重新部署 |
| **📱 PWA** | `manifest.json` + 移动端适配（`max-w-xl`）· 添加到主屏幕独立 App 体验 · 跟进到期系统通知 | 离线可用壳，数据仍走 Supabase |

---

## 📚 知识库 · 10,000 条实战弹药

> 当前线上库实测：**10,000 条 / 0 重复 / `length<150` 为 0 / 平均 335 字 / 向量覆盖 100%**

### 规模与质量

| 指标 | 数值 | 说明 |
|---|---|---|
| **总数** | **10,000** | 全量高质量，无上限管线已就位（改 `target` 即可冲 20k） |
| **去重** | 0 重复标题 | `SELECT title` 内存去重 + 随机后缀防撞 |
| **低质量** | `<150字: 0` / `<300字: 3,770`（62% >300字） | HQ20/HQ22 两轮覆盖重写，10 字水条目已清零 |
| **平均长度** | 335 字 | 均含 **策略步骤 → 可复用话术 → 禁忌事项** 三段式 |
| **向量覆盖** | 10,000 / 10,000 | 远程 `text-embedding-3-small` 优先，无 Key 自动本地哈希兜底 |

### 分类分布

| 分类 | 数量 | 含义 |
|---|---|---|
| `objection` | 3,531 | 异议应对（“贵 20%”“考虑考虑”“要问领导”等客户原话） |
| `other` | 2,956 | 综合认知（成交信号/客户分层/谈判心理等） |
| `script` | 2,307 | 标准话术（开场/报价/逼单/转介绍等场景） |
| `faq` | 1,117 | 产品 FAQ（API/等保/私有化/SLA 等） |
| `case` | 46 | 成功案例 |
| `competitor` | 43 | 竞品对比（FABE 框架，不攻击对手） |

### 行业标签

`通用` 1,629 · `SaaS` 797 · `大客户` 379 · `快消` 348 · `工业制造` 347 · `医疗` / `教育` / `物流` / `金融` / `房地产` 各 289~297，均衡覆盖。

> **写作范式（命中率最高）**：标题含客户原话关键词（如“贵20%”“考虑考虑”），正文按 **客户原话特征 → 本质剖析 → 应对策略 4 步 → 实战话术（可直接发）→ 禁忌**。入库即自动向量化（`title + content`）。

---

## 🏗️ 技术架构

```
                        ┌─ Tailwind CSS + PWA (manifest.json)
Next.js 14 (App Router) ─┤
        │                └─ React 18 + ReactMarkdown (流式渲染)
        │
   Supabase ── Auth 邮箱登录
        │         └─ PostgreSQL + pgvector + RLS 行级隔离
        │              ├─ clients         客户档案（stage/status/profile/next_follow_up）
        │              ├─ interactions    交互流水（summary/commitments/objections/raw_content）
        │              ├─ knowledge_docs  共享知识库 (vector 1536 + industry_tags + used_count)
        │              └─ app_settings    运行时模型配置 + 历史
        │
   多模型适配器 ── DeepSeek / 智谱 GLM / 通义 Qwen / Agnes / OpenAI / 自定义中转
        │            └─ 统一 OpenAI Chat Completions 协议，切换即生效
        │
   Tavily Search API ── 公司 + 行业 双查询，搜集后拼入 Prompt，无 Key 降级
        │
   lib/embedding ── 远程优先（text-embedding-3-small），无 Key 降级本地 1536 维哈希向量
```

**关键设计**：

- **运行时配置下发**：`NEXT_PUBLIC_SUPABASE_URL / ANON_KEY` 走 `/api/public-config` 接口运行时下发，不依赖构建时注入，避免 Vercel 缓存陈旧。
- **流式简报**：`/api/analyze` 返回 `ReadableStream`，前端 `getReader()` 逐字渲染，服务端 `finally` 再落库。
- **PWA 就绪**：`public/manifest.json` + `icon.svg`，手机“添加到主屏幕”即得类原生体验。

---

## 🔒 安全与检索设计

### 安全设计

| 层 | 实现 |
|---|---|
| **应用层鉴权** | `lib/api-utils.ts` 的 `withAuth` 统一校验 `Authorization: Bearer <access_token>`，用 `anon` 验身份，再用 `service_role` 的 `admin` 客户端执行业务 |
| **数据库 RLS** | `clients / interactions` 仅 `auth.uid() = user_id` 可读写；`knowledge_docs` 为 **全局共享读**（`authenticated` 可 `SELECT`），写/删仅贡献者本人（`user_id` 过滤）；`app_settings` 无 Policy，仅 `service_role` 可读写 |
| **应用层隔离补齐** | 因 `admin` 绕过 RLS，所有跨表查询均显式补 `eq("clients.user_id", userId)` / `eq("user_id", userId)`，杜绝跨租户泄露（已修复 `dashboard` / `weekly-report` / `knowledge/[id]` 删除等历史遗留） |
| **密钥** | `SUPABASE_SERVICE_ROLE_KEY` 仅服务端使用；LLM Key 优先存库 `app_settings.llm_config`，历史仅存 `hasKey` 前缀，不存明文；`TAVILY_API_KEY` 服务端专用 |

### 检索设计（10k 规模实测）

| 环节 | 实现 | 参数 |
|---|---|---|
| **候选集** | `knowledge_docs` 取最新 **2,000 条**（`order by created_at desc limit 2000`），列表接口支持 `?page=1&limit=500` 分页（上限 2000，`range` 语法） | `GET /api/knowledge?page=1&limit=500` |
| **向量** | `lib/embedding.ts`：先试远程 `POST {baseURL}/embeddings`（`text-embedding-3-small`，15s 超时），无 Key/失败则 **本地兜底**：中文 bigram + unigram → djb2 哈希 → 1536 维 + L2 归一化，确定性、可复现、零额外费用 | `EMBED_DIM=1536 / MAX_CHARS=6000` |
| **混合评分** | `vectorScore *0.5 + kwNorm*0.5`。其中 `vectorScore` 对本地向量做 `(cos-0.15)/0.45` 映射提升区分度；`kwNorm = min(kwHits / max(grams*0.2,6), 1)`，标题命中 ×2 权重 |  |
| **TopK** | 综合分排序取 **Top3**，阈值 `>0.18`；无果则 bigram 关键词兜底 `kwHits>=2` 取 Top2 | `used_count` 命中自动 +1 |
| **自愈** | `advise` 每次对无向量的历史条目 **懒加载补算 20 条**（`title + content[0:2000]`），`POST /api/knowledge` 入库即向量化 | 10k 已全量回填（`backfill_bulk.py` bulk `VALUES`，400 条/批次） |

> **结论**：无需 `embedding` 专属 Key 也能在 10k 规模下满血检索；有 Key 时向量质量更高，无 Key 时本地哈希保证可用。

---

## 📁 目录结构

```
sales-copilot/
├── app/
│   ├── api/
│   │   ├── analyze/            # POST 流式生成作战简报（Tavily + LLM）
│   │   ├── clients/            # GET/POST 客户列表 & POST 新建（?q= 搜索）
│   │   ├── clients/[id]/       # GET/PATCH/DELETE 客户详情/阶段/删除
│   │   ├── dashboard/          # GET 作战台聚合（漏斗/待跟进/异议TOP/趋势）
│   │   ├── interactions/       # POST 记录交互
│   │   ├── interactions/parse/ # POST 会话情报员（聊天记录→结构化）
│   │   ├── knowledge/          # GET/POST 知识库（分页、分行业）
│   │   ├── knowledge/[id]/     # PATCH/DELETE 单条（仅贡献者）
│   │   ├── knowledge/[id]/view # GET 全文
│   │   ├── knowledge/advise/   # POST 话术军火（混合检索 + LLM）
│   │   ├── knowledge/from-interaction/ # POST 交互一键沉淀为知识
│   │   ├── knowledge/leaderboard/ # GET 贡献榜
│   │   ├── llm-config/         # GET/POST 动态模型配置 + 历史
│   │   ├── llm-models/         # POST 拉取模型列表
│   │   ├── notifications/      # GET 跟进提醒轮询
│   │   ├── public-config/      # GET 运行时 Supabase 公开配置
│   │   └── weekly-report/      # POST AI 周报
│   ├── login/page.tsx
│   ├── page.tsx                # 作战台 / 分析 / 档案 / 军火库 四 Tab 单页
│   ├── layout.tsx
│   └── globals.css
├── lib/
│   ├── llm.ts                  # 多模型适配器（OpenAI 兼容）
│   ├── llm-config.ts           # 运行时配置读写（app_settings）
│   ├── embedding.ts            # 向量化（远程优先 + 本地哈希兜底）
│   ├── search.ts               # Tavily 联网搜索（无 Key 降级）
│   ├── api-client.ts           # 前端 fetch 封装 + 跟进通知轮询
│   ├── api-utils.ts            # 后端 withAuth + ok/fail
│   ├── supabase.ts / supabase-browser.ts
│   └── types.ts
├── supabase/
│   ├── schema.sql              # v4.1 幂等建库（含 pgvector + RLS）
│   └── knowledge-seed.sql      # 种子 18 条示例（线上已扩至 10k）
├── public/
│   ├── manifest.json
│   └── icon.svg
├── .env.example
├── package.json
└── pnpm-lock.yaml
```

---

## 🚀 快速开始

### 一键部署（推荐）

1. 点顶部 **Deploy with Vercel** 按钮
2. 按 Verc生提示创建 GitHub 仓库
3. 准备好以下三样填入环境变量：

| 变量 | 获取方式 | 必填 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | [supabase.com](https://supabase.com) 免费建项目 → Settings → API 复制 | ✅ |
| `LLM_PROVIDER` + 对应 `*_API_KEY`（如 `DEEPSEEK_API_KEY`） | [platform.deepseek.com](https://platform.deepseek.com) 充 ¥10 用数月；或智谱/通义/ OpenAI | ✅ |
| `TAVILY_API_KEY` | [tavily.com](https://tavily.com) 每月免费 1000 次 | 强烈推荐，可空 |

4. 部署完成后到 **Supabase → SQL Editor** 执行 [`supabase/schema.sql`](./supabase/schema.sql)（幂等，可重复跑）
5. （可选）执行 [`supabase/knowledge-seed.sql`](./supabase/knowledge-seed.sql) 写入 18 条种子示例；线上已提供 10k 全量，回填脚本见 `supabase/` 下 `seed_*.py`
6. 打开 `https://<你的>.vercel.app` 注册账号，开始使用 ✅

### 本地开发

```bash
git clone https://github.com/LeilaoMi/sales-copilot.git
cd sales-copilot
cp .env.example .env.local   # 填入真实 Key
pnpm install
pnpm dev                      # http://localhost:3000
pnpm build && pnpm start      # 生产构建校验
```

### 部署后必做

- [ ] Supabase → Authentication → Providers → 启用 **Email**（建议关闭 *Confirm email*，个人工具免邮箱验证）
- [ ] SQL Editor 执行 `schema.sql`（含 `create extension if not exists vector/pgcrypto`）
- [ ] 打开网站右上角 **⚙️** → 测试连接 & 拉取模型列表，确认 AI 接入正常
- [ ] 浏览器 → **添加到主屏幕**（PWA）
- [ ] （可选）Supabase → Table Editor 确认 `knowledge_docs` 已有数据（种子 18 条或全量 10k）

---

## 🔑 环境变量

| 变量 | 说明 | 示例 |
|---|---|---|
| `LLM_PROVIDER` | 默认模型商：`deepseek / zhipu / qwen / agnes / openai`，出海时改 `openai` 即可；支持 `custom:名称|https://xxx/v1` | `deepseek` |
| `DEEPSEEK_API_KEY` / `ZHIPU_API_KEY` / `QWEN_API_KEY` / `AGNES_API_KEY` / `OPENAI_API_KEY` | 对应服务商的 Key，运行时可在网页端 ⚙️ 覆盖 | `sk-xxx` |
| `TAVILY_API_KEY` | 联网搜索 Key，留空自动降级 | `tvly-xxx` |
| `SEARCH_MAX_RESULTS` | 每次分析抓取的搜索结果条数（1-10，默认 5） | `5` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon / publishable Key（公开） | `eyJxxx` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key（服务端专用，绝不进前端） | `eyJxxx` |

> 运行时配置优先级：**数据库 `app_settings.llm_config`（网页端保存）> 环境变量 > 默认值 `deepseek`**。网页端支持保存历史 10 条，一键切回。

---

## 🗄️ 数据模型

### `clients` 客户档案

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `user_id` | `uuid` FK → `auth.users` | 归属用户，RLS 隔离 |
| `name` | `text` | 客户姓名 |
| `company / title / industry / note` | `text` | 公司/职位/行业/备注 |
| `stage` | `text` | `lead / touched / proposal / negotiation / won / lost` |
| `status` | `text` | `generating / ready / failed`（`generating` 超 10 分钟自愈为 `failed`） |
| `profile` | `jsonb` | 作战简报全文（Markdown） |
| `next_follow_up` | `timestamptz` | 下次跟进时间 |
| `created_at` | `timestamptz` | |

### `interactions` 交互流水

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `uuid` PK | |
| `client_id` | `uuid` FK → `clients` | `cascade` |
| `type` | `text` | `call / wechat / meeting / email / other` |
| `summary` | `text` | 摘要 |
| `commitments / objections` | `jsonb` | 承诺/异议数组 |
| `next_step / next_step_time` | `text / timestamptz` | 下一步及时间，同步回写 `clients.next_follow_up` |
| `raw_content` | `text` | 原始聊天记录（≤8000） |
| `created_at` | `timestamptz` | |

### `knowledge_docs` 共享知识库

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` | 贡献者（仅用于溯源，`SELECT` 全员可见） |
| `title` | `text` | 标题（含客户原话关键词最佳） |
| `category` | `text` | `objection / faq / competitor / case / script / other` |
| `content` | `text` | 正文 Markdown（策略/话术/禁忌）|
| `embedding` | `vector(1536)` | `pgvector`，1536 维 |
| `industry_tags` | `text[]` | 行业标签，如 `{"SaaS","通用"}` |
| `used_count` | `int` | 被 `advise` 命中次数 |
| `created_at` | `timestamptz` | |

索引：`idx_clients_user / idx_knowledge_user / idx_knowledge_used_count`，向量索引 `ivfflat` 可在数据量 >100 后按需创建。

### `app_settings` 运行时配置

| 字段 | 类型 | 说明 |
|---|---|---|
| `key` | `text` PK | `llm_config` / `llm_history` |
| `value` | `jsonb` | `{provider, apiKey, model, updated_at} / [...]` |
| `updated_at` | `timestamptz` | |

RLS：`enable RLS` 且无 Policy，仅 `service_role` 可读写。

---

## 🔌 API 一览

> 全部接口经 `withAuth` 校验 `Bearer <access_token>`，前端经 `lib/api-client.ts` 的 `apiFetch` 自动携带，401 自动跳 `/login`。

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/api/analyze` | 生成作战简报（流式 `text/plain`，含 Tavily 搜集 + `buildBriefPrompt` + `streamChat`，`maxDuration=300`） |
| `GET` | `/api/clients?q=` | 客户列表（`?q=` 搜 姓名/公司/行业/备注，防注入） |
| `POST` | `/api/clients` | 手动新建客户（不走 AI） |
| `GET` | `/api/clients/[id]` | 客户详情 + 交互历史 |
| `PATCH` | `/api/clients/[id]` | 更新 `stage / note / title / next_follow_up` |
| `DELETE` | `/api/clients/[id]` | 删除客户（级联交互） |
| `POST` | `/api/interactions` | 记录交互（校验归属，同步 `next_follow_up`） |
| `POST` | `/api/interactions/parse` | 会话情报员（`{text}` → 结构化 JSON） |
| `GET` | `/api/knowledge?q=&industry=&page=&limit=` | 知识列表（全局共享，`q` 搜标题/正文，`industry` 过滤 `industry_tags`，分页 `limit` 500 默认/2000 上限） |
| `POST` | `/api/knowledge` | 新增知识（自动向量化，`industry_tags`） |
| `PATCH` | `/api/knowledge/[id]` | 更新（仅贡献者，内容变则 `embedding=null` 懒更新） |
| `DELETE` | `/api/knowledge/[id]` | 删除（仅贡献者，需 `user_id` 校验） |
| `GET` | `/api/knowledge/[id]/view` | 全文（登录即可读） |
| `POST` | `/api/knowledge/advise` | 话术军火（`{situation}` → 混合检索 2000 候选 → Top3 + LLM） |
| `POST` | `/api/knowledge/from-interaction` | 交互一键沉淀为脱敏知识（LLM 提炼） |
| `GET` | `/api/knowledge/leaderboard` | 贡献榜（`docs / used`，突破 50 限制分页拉取） |
| `GET` | `/api/dashboard` | 作战台聚合（漏斗/待跟进/异议TOP/趋势，显式 `user_id` 隔离） |
| `GET` | `/api/notifications` | 跟进提醒（48h 内到期 + 已过期） |
| `POST` | `/api/weekly-report` | AI 周报（近 7 天数据汇总 + LLM） |
| `GET` | `/api/public-config` | 运行时公开配置（`url / anonKey`） |
| `GET/POST` | `/api/llm-config` | 查看/保存 AI 接入配置（历史 10 条） |
| `POST` | `/api/llm-models` | 拉取模型列表（`{provider/baseURL/apiKey}`） |

---

## 🤝 加入知识共建

这个项目最大的差异化是**全局共享的实战知识库**——所有部署实例共用同一份销售智慧，越用越准：

1. **贡献**：军火库页 → 「贡献你的实战经验」→ 选分类填标题正文 → 入库即自动向量化（远程或本地）
2. **沉淀**：每次真实成交/丢单后，客户详情 → 交互卡片点「✦ 沉淀为共享知识」→ AI 自动脱敏提炼 `title / content`（`category=case`）
3. **荣誉**：军火命中 `used_count +1`，贡献榜公示最实用的经验来源

> **写作范式**：标题含“客户原话特征”关键词（如“贵 20%”“考虑考虑”“要问领导”），正文按 **策略步骤 → 可复用话术 → 禁忌事项** 三段式，检索命中率最高。支持 `industry_tags`（如 `SaaS / 工业制造 / 快消`）提升行业过滤精度。

欢迎 PR：新功能、知识条目、Bug 修复均欢迎。知识条目 PR 请确保标题唯一、内容 >150 字、含三段式。

---

## 📈 更新日志

- **2026-08-28 · v1.1 + 10k**：知识库扩至 **10,000 条**（`HQ20/HQ22` 覆盖重写 961 条水数据 + 无上限管线），平均 335 字，`0 重复 / <150:0 / 向量 100%`；`embedding` 本地哈希兜底（无 Key 也满血）、知识列表分页至 2000、军火检索候选 2000 & 阈值 0.18；`schema.sql` 补 `vector` 扩展并完成全量 `backfill_bulk`
- **2026-08-28 · P0/P1 修复**：`schema` 去重建表 / `DELETE /knowledge/[id]` 加 `user_id` 校验 / `dashboard` & `weekly-report` 补租户隔离 / `advise` 混合检索重写为 Top3 / `analyze` 流中断与僵尸自愈 / `llm-config` 历史脱敏 / `leaderboard` 分页
- **2026-08-26 · v1.0**：AI 接入对标 Codex 级（测试连接 & 拉取模型 & 历史一键切）、PWA、跟进通知闭环

---

## 🙏 致谢

设计灵感来自以下优秀的开源项目，详见 [ACKNOWLEDGEMENTS.md](./ACKNOWLEDGEMENTS.md)：

[ai-company-researcher](https://github.com/mayooear/ai-company-researcher) · [sales-outreach-automation-langgraph](https://github.com/kaymen99/sales-outreach-automation-langgraph) · [SalesGPT](https://github.com/filip-michalsky/SalesGPT)

如果这个项目对你有帮助，请给它们也点个 Star ⭐

---

## License

MIT © 2026

