import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./env";

// 浏览器端鉴权客户端 - 登录、会话管理
export function getSupabaseBrowser() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"));
}