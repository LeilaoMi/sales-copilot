// 多模型适配器 - 所有主流厂商兼容 OpenAI 协议
// 切换供应商 = 改一个环境变量，架构层面为出海预留
import { optionalEnv } from "./env";

const PROVIDERS: Record<string, { baseURL: string; model: string }> = {
  deepseek: { baseURL: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  zhipu:    { baseURL: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash" },
  qwen:     { baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
  agnes:    { baseURL: "https://apihub.agnes-ai.com/v1", model: "agnes-2.5-flash" },
  openai:   { baseURL: "https://api.openai.com/v1", model: "gpt-4o-mini" },
};

export function getProvider() {
  const name = optionalEnv("LLM_PROVIDER", "deepseek");
  const p = PROVIDERS[name];
  if (!p) throw Object.assign(new Error(`未知模型商: ${name}，可选: ${Object.keys(PROVIDERS).join("/")}`), { status: 500 });
  return { ...p, apiKey: process.env[`${name.toUpperCase()}_API_KEY`] || "", name };
}

export async function* streamChat(messages: { role: string; content: string }[]) {
  const p = getProvider();
  if (!p.apiKey) {
    throw Object.assign(new Error(`${p.name.toUpperCase()}_API_KEY 未配置`), { status: 500 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000); // 上游硬超时

  let res: Response;
  try {
    res = await fetch(`${p.baseURL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.apiKey}` },
      body: JSON.stringify({ model: p.model, messages, stream: true, temperature: 0.7 }),
      signal: controller.signal,
    });
  } catch (e: any) {
    clearTimeout(timeout);
    throw Object.assign(new Error(`无法连接模型服务: ${e.message}`), { status: 502 });
  }

  if (!res.ok) {
    clearTimeout(timeout);
    const text = await res.text().catch(() => "");
    throw Object.assign(new Error(`模型服务返回 ${res.status}: ${text.slice(0, 200)}`), { status: 502 });
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop()!;
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") return;
        try {
          const delta = JSON.parse(data).choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // 忽略心跳/注释行
        }
      }
    }
  } finally {
    clearTimeout(timeout);
    reader.releaseLock?.();
  }
}

export function buildBriefPrompt(client: { name: string; title?: string; company?: string; industry?: string; note?: string }) {
  const t = client.title || "关键决策人";
  return `你是资深B2B销售情报分析官。基于行业知识，为以下销售任务生成作战简报。
客户信息：
- 姓名：${client.name}，职位：${t}
- 公司：${client.company || "未知"}（${client.industry || "未知"}行业）
- 背景：${client.note || "无"}

严格按以下 Markdown 结构输出，内容必须具体、可执行、有洞察，禁止空话套话：

# 客户作战简报：${client.name}

## 一、公司背景速览
## 二、行业痛点 TOP3
（每条：现象 → 影响 → 我们的切入机会）
## 三、${t}最关心的三件事
## 四、首次拜访开场白（中文版，90秒内讲完，含一个钩子问题）
## 五、Opening Script (English)
## 六、雷区提醒`;
}

// 从流式输出中提取客户姓名（用于失败时兜底入库），提取不到返回 null
export function extractClientName(prompt: string): string | null {
  const m = prompt.match(/姓名：(.+?)，/);
  return m ? m[1].trim() : null;
}