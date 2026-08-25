# 🎯 销售情报官

AI 驱动的销售作战助手。输入客户信息，30 秒生成结构化「客户作战简报」，自动沉淀为客户档案，支持销售阶段管理。

## 功能

- **情报分析**：输入客户姓名/职位/公司/行业/背景，流式输出作战简报（公司背景、行业痛点、决策人关注点、双语开场白、雷区提醒）
- **历史档案**：所有报告自动入库，随时回看
- **阶段管理**：线索 → 已接触 → 已出方案 → 谈判中 → 成交/失败

## 技术栈

Next.js 14 (App Router) + Tailwind CSS + Supabase (PostgreSQL) + 多模型适配器（DeepSeek / 智谱 / 通义 / OpenAI 一键切换）

## 部署步骤

### 1. 创建数据库

1. 到 [supabase.com](https://supabase.com) 注册并新建免费项目
2. 进入 SQL Editor，粘贴 `supabase/schema.sql` 全部内容并执行
3. 在 Project Settings → API 页面拿到 `Project URL` 和 `anon public key`

### 2. 配置模型 Key

推荐 [DeepSeek 开放平台](https://platform.deepseek.com) 充值 ¥10 即可长期使用；或用智谱 glm-4-flash 免费额度。

### 3. 本地运行

```bash
cp .env.example .env.local   # 填入真实 Key
npm install
npm run dev                  # http://localhost:3000
```

### 4. 上线部署

推送到 GitHub 后导入 [Vercel](https://vercel.com)，配置环境变量：

```
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-xxx
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
```

部署完成后手机电脑均可访问。

## 出海扩展

面向海外客户时只需改一个环境变量：`LLM_PROVIDER=openai` + 对应 API Key，界面与数据库零改动。

## 安全提示

- `.env.local` 已在 .gitignore 中，切勿提交密钥到仓库
- 客户数据存储于你自己的 Supabase 项目，注意遵守当地数据保护法规
- 生产使用建议开启 Supabase Auth 登录校验

## License

MIT