# 🎯 销售情报官

AI 驱动的个人销售作战助手。输入客户信息 → 自动联网搜集情报 → 流式生成结构化「作战简报」→ 沉淀为带鉴权的客户档案库，覆盖销售全流程管理。

## 功能全景

- **联网情报分析**：Tavily 搜索公司新闻+行业动态 → LLM 综合生成简报（背景 / 痛点 / 决策人关注点 / 中英双语开场白 / 雷区 / 情报来源）；无搜索 Key 自动降级为纯知识模式
- **账号体系**：邮箱密码登录，数据按用户隔离（应用层 + RLS 双保险）
- **历史档案**：服务端自动入库；关键词搜索、删除、失败重试、一键复制
- **阶段管理**：线索 → 已接触 → 已出方案 → 谈判中 → 成交/失败
- **交互记录**：电话/微信/会面快速记录，自动回写跟进时间

## 技术栈

Next.js 14 (App Router) · Tailwind CSS · Supabase (Auth + PostgreSQL + RLS) · Tavily Search · 多模型适配器（DeepSeek / 智谱 / 通义 / Agnes / OpenAI 环境变量一键切换）

## 快速开始

### 1. 数据库与认证

1. [supabase.com](https://supabase.com) 新建免费项目 → SQL Editor 执行 `supabase/schema.sql`（幂等）
2. Authentication → Providers 启用 Email（建议关闭 Confirm email 免邮箱验证）
3. Project Settings → API 拿到 `Project URL`、`Publishable/anon key`、`Secret/service_role key`

### 2. 配置 Key

| 服务 | 用途 | 获取 |
|---|---|---|
| DeepSeek 等 LLM | 简报生成 | [platform.deepseek.com](https://platform.deepseek.com)，¥10 用数月 |
| Tavily（可选但强烈推荐） | 联网情报 | [tavily.com](https://tavily.com)，每月免费 1000 次 |

### 3. 本地运行

```bash
cp .env.example .env.local   # 填入真实值
npm install
npm run dev                  # http://localhost:3000
```

### 4. 部署上线

推 GitHub → 导入 [Vercel](https://vercel.com) → 环境变量：

```
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-xxx
TAVILY_API_KEY=tvly-xxx            # 可选，不填则纯离线模式
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx
```

> 公开配置通过运行时接口下发（`/api/public-config`），不依赖构建时注入——改 Supabase 地址后无需担心构建缓存陈旧问题。

## 架构亮点

| 层 | 设计 |
|---|---|
| 安全 | withAuth 统一鉴权 + PostgreSQL RLS 行级隔离 + service_role 仅服务端 |
| 可靠 | 报告服务端流式累积落库 + generating/ready/failed 状态机 + 失败重试 |
| 智能 | search-then-synthesize 双段管线 + 无网优雅降级 + 来源标注防幻觉 |
| 弹性 | maxDuration=300 + LLM 上游 120s 硬超时 + 搜索 15s 超时不阻塞 |

## 致敬

设计灵感来自 [ai-company-researcher](https://github.com/mayooear/ai-company-researcher)、[sales-outreach-automation-langgraph](https://github.com/kaymen99/sales-outreach-automation-langgraph)、[SalesGPT](https://github.com/filip-michalsky/SalesGPT)，详见 [ACKNOWLEDGEMENTS.md](./ACKNOWLEDGEMENTS.md)。觉得有帮助请顺手给它们点 Star ⭐

## License

MIT