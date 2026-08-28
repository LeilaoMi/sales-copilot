import { withAuth, fail, ok } from "@/lib/api-utils";
import { getLlmConfig, saveLlmConfig, listLlmHistory, pushLlmHistory } from "@/lib/llm-config";

export const runtime = "nodejs";

// GET /api/llm-config - 查看当前 AI 接入配置（Key 不回传明文，附带历史列表）
export const GET = withAuth(async (_req, { userId }) => {
  void userId;
  try {
    const [cfg, history] = await Promise.all([getLlmConfig(), listLlmHistory().catch(() => [])]);
    return ok({
      provider: cfg.provider,
      model: cfg.model || "",
      hasKey: Boolean(cfg.apiKey),
      source: cfg.source,
      history,
    });
  } catch (e: any) {
    return fail(e.message, 500);
  }
});

// POST /api/llm-config - 网页端动态切换 AI 接入
// body: { provider, apiKey?, model? }
export const POST = withAuth(async (req, { userId }) => {
  void userId;
  const body = await req.json();
  if (!body.provider || !String(body.provider).trim()) {
    return fail("provider 必填", 400);
  }
  // 自定义接口必须带 Key（无环境变量可兜底）
  if (body.provider.startsWith("custom:") && !body.apiKey?.trim()) {
    return fail("自定义接口需要填写 API Key", 400);
  }

  try {
    await saveLlmConfig(String(body.provider), String(body.apiKey || ""), body.model ? String(body.model) : undefined);
    // 历史仅存 provider+model，不存明文 Key
    await pushLlmHistory(String(body.provider), body.model ? String(body.model) : undefined).catch(() => {});
    return ok({ saved: true });
  } catch (e: any) {
    return fail(e.message, 500);
  }
});