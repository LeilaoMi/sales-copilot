# 🎯 销售情报官

AI 驱动的销售作战助手。输入客户信息，30 秒生成结构化「客户作战简报」，自动沉淀为带鉴权的客户档案库，支持销售阶段管理与交互记录。

## 功能

- **情报分析**：输入客户姓名/职位/公司/行业/背景 → 流式输出作战简报（公司背景 / 行业痛点 / 决策人关注点 / 双语开场白 / 雷区提醒）
- **账号体系**：邮箱密码注册登录，数据按用户严格隔离（应用层 + 数据库 RLS 双保险）
- **历史档案**：报告服务端自动入库；支持关键词搜索、删除、失败重试、一键复制
- **阶段管理**：线索 → 已接触 → 已出方案 → 谈判中 → 成交/失败
- **交互记录**：每次电话/微信/会面后快速记录沟通摘要与下一步动作，自动回写跟进时间

## 技术栈

Next.js 14 (App Router) · Tailwind CSS · Supabase (Auth + PostgreSQL + RLS) · 多模型适配器（DeepSeek / 智谱 / 通义 / OpenAI 环境变量切换）

## 部署步骤（约 15 分钟）

### 1. 创建数据库 + 认证

1. 到 [supabase.com](https://supabase.com) 注册并新建免费项目
2. SQL Editor 中粘贴 `supabase/schema.sql` 全部内容执行（幂等，可重复跑）
3. Authentication → Providers → 启用 Email
4. 建议关闭 "Confirm email"（个人工具免邮箱验证）；保留则注册后需查收确认邮件
5. Project Settings → API 页面拿到三个值：
   - `Project URL`
   - `anon public` key
   - `service_role` key ⚠️ 服务端专用，绝不进前端代码和 git

### 2. 配置模型 Key

推荐 [DeepSeek 开放平台](https://platform.deepseek.com) 充值 ¥10 可长期使用；或智谱 glm-4-flash 免费。

### 3. 本地开发

```bash
cp .env.example .env.local   # 填入真实值
npm install
npm run dev                  # http://localhost:3000
```

首次打开会跳登录页 → 注册一个账号 → 进入主界面。

### 4. 部署上线

推送到 GitHub 后导入 [Vercel](https://vercel.com)，环境变量：

```
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-xxx
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx
```

部署完成手机电脑均可访问。

> Vercel 免费档函数已配置 `maxDuration=300`，长报告不会被 10s 掐断。如遇 Vercel 域名国内访问不稳，绑自定义域名走 Cloudflare 即可。

## 安全架构

| 层 | 机制 |
|---|---|
| 应用层 | 所有 API 路由经 `withAuth` 校验 Bearer token，未登录一律 401 |
| 数据层 | PostgreSQL RLS：每行数据绑定 user_id，跨用户读写被数据库直接拒绝 |
| 密钥层 | service_role key 仅存在于服务端进程；前端只有受限的 anon key |
| 输入层 | 类型校验、时间格式校验、交互类型白名单 |

## 出海扩展

面向海外客户时改一个环境变量即可：`LLM_PROVIDER=openai` + `OPENAI_API_KEY`，界面与数据库零改动。

## License

MIT