# 致敬与致谢 (ACKNOWLEDGEMENTS)

本项目的部分设计灵感来自以下优秀的开源项目。它们不是被复制的代码库，而是站在它们肩膀上的独立实现。

## 设计灵感来源

### [mayooear/ai-company-researcher](https://github.com/mayooear/ai-company-researcher) — MIT License
- **贡献**：search-then-synthesize 管线思路——先联网搜集资料、再交给 LLM 综合分析的两段式架构
- **用在哪**：`lib/search.ts` 的 Tavily 集成模式与降级策略

### [kaymen99/sales-outreach-automation-langgraph](https://github.com/kaymen99/sales-outreach-automation-langgraph) — MIT License
- **贡献**：销售漏斗多环节 Agent 化的整体思路（research → qualification → outreach 分阶段处理）
- **用在哪**：本项目「情报官 → 档案 → 跟进」的模块化拆分哲学

### [filip-michalsky/SalesGPT](https://github.com/filip-michalsky/SalesGPT) — MIT License
- **贡献**：产品知识注入与情境感知对话的 prompt 工程范式
- **用在哪**：作战简报的结构化 prompt 模板设计

## 本项目独立完成的部分

- Next.js 14 App Router 全栈架构
- Supabase Auth + RLS 双层安全体系
- 运行时配置下发机制（解决构建缓存陈旧变量问题）
- 多模型适配器（DeepSeek / 智谱 / 通义 / Agnes / OpenAI）
- 流式报告生成 + 服务端落库状态机
- 客户阶段管理与交互记录系统

## 许可说明

本项目采用 MIT License。若上述项目对你有帮助，请给它们的仓库点个 Star。

---

*Standing on the shoulders of giants. 🙏*