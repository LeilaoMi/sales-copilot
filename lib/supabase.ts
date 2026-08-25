import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./env";

// 服务端数据库客户端（绕过 RLS，配合应用层鉴权使用）
export function getSupabaseAdmin() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
}