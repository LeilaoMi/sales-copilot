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
  const { error } = await admin.from("app_settings").upsert({
    key: "llm_config",
    value: JSON.stringify({ provider, apiKey, model: model || null, updated_at: new Date().toISOString() }),
  }, { onConflict: "key" });
  if (error) throw new Error(`保存配置失败: ${error.message}`);
}