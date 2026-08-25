import { requireEnv } from "@/lib/env";

export const runtime = "nodejs";

// 公开配置运行时下发
// Publishable Key 设计上就是给浏览器用的公开凭据（受 RLS 管控），
// 走接口而非构建时注入，彻底规避构建缓存的陈旧变量问题
export async function GET() {
  try {
    return Response.json({
      url: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      anonKey: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}