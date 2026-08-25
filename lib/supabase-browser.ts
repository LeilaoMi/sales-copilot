// 浏览器端鉴权客户端 - 运行时从服务端拉取公开配置，不再依赖构建时注入
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export async function getSupabaseBrowser(): Promise<SupabaseClient> {
  if (cached) return cached;
  const res = await fetch("/api/public-config");
  if (!res.ok) throw new Error("服务配置加载失败，请刷新重试");
  const { url, anonKey } = await res.json();
  if (!url || !anonKey) throw new Error("服务配置不完整");
  cached = createClient(url, anonKey);
  return cached;
}