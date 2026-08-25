<div align="center">

# 🎯 销售情报官

**AI-Powered Sales Copilot · 开源自部署的销售作战系统**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/LeilaoMi/sales-copilot&env=LLM_PROVIDER,DEEPSEEK_API_KEY,NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY&project-name=sales-copilot)

*输入客户信息 → 联网搜集情报 → 30 秒生成作战简报 → 沉淀为可复用的团队知识资产*

</div>

---

## 为什么做这个

销售每天真正花在「研究客户、复盘谈话、整理经验」上的时间，远比实际开单的多。这些重复劳动，正是 AI 该干的活。

销售情报官把一条完整的销售作战闭环搬进了网页：

```
 🕵️ 找线索    ──▶  输入客户信息，Tavily 联网搜集公司/行业情报，生成结构化作战简报
 💬 谈完之后  ──▶  粘贴微信聊天记录，AI 自动提取承诺 / 异议 / 下一步 + 建议回复
 🔫 谈判卡壳  ──▶  输入客户原话，从社区知识库调取实战弹药，生成定制应对话术
 ⏰ 忘性大    ──▶  跟进到期自动弹通知，过期未跟进重点标红
 📊 每周日晚  ──▶  AI 复盘本周数据：漏斗健康度、卡单分析、下周行动清单
 🧠 打完一仗  ──▶  一键把交互沉淀为脱敏的社区共享知识，越用越强
```

## ✨ 核心特性

| 模块 | 能力 |
|---|---|
| **🎯 作战台** | 销售漏斗可视化 · 本周待跟进 · 客户高频异议 TOP5 · 近7日交互趋势 |
| **🕵️ 情报官** | Tavily 双查询（公司+行业）→ LLM 综合 → 简报附情报来源防幻觉；无 Key 自动降级 |
| **✨ 会话情报员** | 聊天原文 → 结构化提取（摘要/承诺/异议/下一步）→ 一键入库客户档案 |
| **🔫 话术军火** | 全局共享知识库 + 向量/关键词混合检索 + LLM 定制应对方案 |
| **📊 AI 周报** | 汇总一周数据，生成复盘报告与下周行动清单 |
| **🏆 社区共建** | 知识全局共享 · 行业标签 · 被引用热度计数 · 贡献者排行榜 |
| **⚙️ 动态接模** | 网页端随时切换 DeepSeek/智谱/通义/OpenAI 或任意 OpenAI 兼容接口，保存即生效 |
| **📱 PWA** | 手机添加到主屏幕，独立 App 体验 |

## 🏗️ 技术架构

```
Next.js 14 (App Router) ── Tailwind CSS ── PWA
        │
   Supabase ── Auth 邮箱登录
        │         └─ PostgreSQL + RLS 行级隔离
        │              ├─ clients      客户档案
        │              ├─ interactions 交互流水
        │              ├─ knowledge_docs 共享知识库 (pgvector)
        │              └─ app_settings  运行时模型配置
        │
   多模型适配器 ── DeepSeek / 智谱 / 通义 / Agnes / OpenAI / 自定义中转
        │
   Tavily Search API（联网情报）
```

**安全设计**：应用层 `withAuth` 统一鉴权 + 数据库 RLS 双保险；`service_role` 仅存在于服务端；公开配置走运行时接口下发而非构建时注入。

**检索设计**：向量语义 50% + 中文 bigram 关键词 50% 的混合评分，无向量时自动降级关键词通道——不因模型接口差异而失灵。

## 🚀 快速开始

### 一键部署（推荐）

1. 点上方 **Deploy with Vercel** 按钮
2. 按 Vercel 提示创建 GitHub 仓库
3. 准备好以下三样填入环境变量：

| 变量 | 获取方式 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` / `SERVICE_ROLE_KEY` | [supabase.com](https://supabase.com) 免费建项目，Settings→API 页复制 |
| `DEEPSEEK_API_KEY` | [platform.deepseek.com](https://platform.deepseek.com) 充 ¥10 用数月 |
| `TAVILY_API_KEY`（可选但强烈推荐） | [tavily.com](https://tavily.com) 每月免费 1000 次 |

4. 部署完成后到 Supabase SQL Editor 执行 [`supabase/schema.sql`](./supabase/schema.sql)
5. 打开网站注册账号，开始使用 ✅

<details>
<summary><b>手动本地开发</b></summary>

```bash
git clone https://github.com/LeilaoMi/sales-copilot.git
cd sales-copilot
cp .env.example .env.local   # 填入真实 Key
pnpm install
pnpm dev                      # http://localhost:3000
```

</details>

### 部署后必做

- [ ] Supabase Authentication → 启用 Email 登录（建议关闭 Confirm email）
- [ ] SQL Editor 执行 schema.sql（幂等可重复跑）
- [ ] 右上角 ⚙️ 检查 AI 接入是否正常
- [ ] 手机浏览器 → 添加到主屏幕

## 🤝 加入知识共建

这个项目最大的差异化是**全局共享的实战知识库**——所有部署实例共用同一份销售智慧：

1. **贡献**：军火库页 → 「贡献你的实战经验」→ 入库即自动向量化
2. **沉淀**：每次真实成交后，交互卡片点「✦ 沉淀为共享知识」→ AI 自动脱敏提炼
3. **荣誉**：命中被计数，贡献榜公示最实用的经验来源

> 写作范式：标题含「客户原话特征」关键词（如"贵20%""考虑考虑"），正文按 **策略步骤 → 可复用话术 → 禁忌事项** 三段式。这样检索命中率最高。

欢迎 PR：新功能、知识条目、Bug 修复均欢迎。

## 🙏 致谢

设计灵感来自以下优秀的开源项目，详见 [ACKNOWLEDGEMENTS.md](./ACKNOWLEDGEMENTS.md)：

[ai-company-researcher](https://github.com/mayooear/ai-company-researcher) · [sales-outreach-automation-langgraph](https://github.com/kaymen99/sales-outreach-automation-langgraph) · [SalesGPT](https://github.com/filip-michalsky/SalesGPT)

如果这个项目对你有帮助，请给它们也点个 Star ⭐

## License

MIT © 2026