import { NextRequest } from "next/server";
import { withAuth, fail, ok } from "@/lib/api-utils";
import { getLlmConfig } from "@/lib/llm-config";

export const runtime = "nodejs";

// POST /api/llm-models - 拉取指定接口的可用模型列表
// body: { provider?, apiKey?, baseURL? }
export const POST = withAuth(async (req, { userId }) => {
  void userId;
  const body = await req.json().catch(() => ({}));
  let baseURL = "";
  let apiKey = "";

  if (body.baseURL) {
    baseURL = String(body.baseURL).trim().replace(/\/+$/, "");
    apiKey = String(body.apiKey || "");
  } else if (body.provider && body.provider.startsWith("custom:")) {
    const [, rest] = body.provider.split("custom:");
    [, baseURL] = rest.split("|");
  } else {
    const cfg = await getLlmConfig();
    const prov = body.provider || cfg.provider;
    if (prov.startsWith("custom:")) {
      [, baseURL] = prov.split("custom:")[1].split("|");
      apiKey = cfg.apiKey || "";
    } else {
      const MAP: Record<string, string> = {
        deepseek: "https://api.deepseek.com/v1",
        zhipu: "https://open.bigmodel.cn/api/paas/v4",
        qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        agnes: "https://apihub.agnes-ai.com/v1",
        openai: "https://api.openai.com/v1",
      };
      baseURL = MAP[prov] || "";
      apiKey = body.apiKey || process.env[`${prov.toUpperCase()}_API_KEY`] || "";
    }
  }

  if (!baseURL) return fail("无法确定 API 地址", 400);

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(`${baseURL}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) return fail(`接口返回 ${res.status}`, 502);
    const data = await res.json();
    const ids: string[] = (data.data || []).map((m: any) => m.id).filter(Boolean);
    return ok({ models: ids.sort() });
  } catch (e: any) {
    return fail(e.message === "The operation was aborted." ? "连接超时" : e.message, 502);
  }
});
