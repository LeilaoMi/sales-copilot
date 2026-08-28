// AI 接入配置 - 运行时动态读写
// 优先级：数据库配置（网页设置）> 环境变量 > 默认值
import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./env";

export interface LlmRuntimeConfig {
  provider: string;       // "deepseek" | "agnes" | "custom:名称|baseURL"
  model?: string;
  apiKey?: string;
  source: "database" | "env" | "default";
}

function getAdmin() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
}

export async function getLlmConfig(): Promise<LlmRuntimeConfig> {
  // 1. 尝试从数据库读运行时配置（app_settings 表）
  try {
    const admin = getAdmin();
    const { data } = await admin.from("app_settings").select("value").eq("key", "llm_config").single();
    if (data?.value) {
      const cfg = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      if (cfg.provider) {
        return {
          provider: cfg.provider,
          model: cfg.model,
          apiKey: cfg.apiKey,
          source: "database",
        };
      }
    }
  } catch {
    // 表不存在或未配置，走环境变量
  }

  // 2. 环境变量兜底
  const envProvider = process.env.LLM_PROVIDER || "";
  if (envProvider) {
    return { provider: envProvider, source: "env", apiKey: process.env[`${envProvider.toUpperCase()}_API_KEY`] };
  }

  return { provider: "deepseek", source: "default" };
}

export async function saveLlmConfig(provider: string, apiKey: string, model?: string): Promise<void> {
  const admin = getAdmin();
  // P1-6 缓解：若调用方传空 apiKey，则保留库中旧 Key（支持“留空沿用现有”）
  let finalKey = apiKey;
  if (!apiKey || !apiKey.trim()) {
    try {
      const { data } = await admin.from("app_settings").select("value").eq("key", "llm_config").single();
      const existing = data?.value ? (typeof data.value === "string" ? JSON.parse(data.value) : data.value) : null;
      if (existing?.apiKey) finalKey = existing.apiKey;
    } catch {}
  }
  const { error } = await admin.from("app_settings").upsert({
    key: "llm_config",
    value: JSON.stringify({ provider, apiKey: finalKey, model: model || null, updated_at: new Date().toISOString() }),
  }, { onConflict: "key" });
  if (error) throw new Error(`保存配置失败: ${error.message}`);
}

// P1-6 修复：历史记录仅存 hasKey + 前缀，不存明文全量 Key
export async function pushLlmHistory(provider: string, model?: string): Promise<void> {
  const admin = getAdmin();
  let history: any[] = [];
  try {
    const { data } = await admin.from("app_settings").select("value").eq("key", "llm_history").single();
    const raw = data?.value ? (typeof data.value === "string" ? JSON.parse(data.value) : data.value) : [];
    history = Array.isArray(raw) ? raw : [];
  } catch {}
  // 去重：同 provider+model 视为同一条，新的放最前
  history = history.filter((h: any) => !(h.provider === provider && (h.model || "") === (model || "")));
  history.unshift({ provider, model: model || "", hasKey: true, keyPrefix: provider.slice(0, 4) + "***", updated_at: new Date().toISOString() });
  // 仅保留最近 10 条，且不含明文 Key
  await admin.from("app_settings").upsert({
    key: "llm_history",
    value: JSON.stringify(history.slice(0, 10)),
  }, { onConflict: "key" });
}

export async function listLlmHistory(): Promise<{ provider: string; model: string; hasKey: boolean; keyPrefix?: string; updated_at: string }[]> {
  try {
    const admin = getAdmin();
    const { data } = await admin.from("app_settings").select("value").eq("key", "llm_history").single();
    const raw = data?.value ? (typeof data.value === "string" ? JSON.parse(data.value) : data.value) : [];
    return Array.isArray(raw) ? raw.slice(0, 10) : [];
  } catch { return []; }
}