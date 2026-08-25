// 统一 API 响应封装 - 消除每个路由里的重复错误处理
import { NextRequest } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";

export function ok(data: any) {
  return Response.json(data);
}

export function fail(message: string, status = 500) {
  return Response.json({ error: message }, { status });
}

// 包装路由处理器：统一鉴权 + 错误兜底
export function withAuth(
  handler: (req: NextRequest, ctx: { supabase: SupabaseClient; userId: string }) => Promise<Response>
) {
  return async (req: NextRequest, routeCtx?: any) => {
    try {
      const authHeader = req.headers.get("authorization") || "";
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (!token) return fail("未登录，请先登录", 401);

      const { createClient } = await import("@supabase/supabase-js");
      const { requireEnv } = await import("./env");
      const anon = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"));
      const { data, error } = await anon.auth.getUser(token);
      if (error || !data?.user) return fail("登录已过期，请重新登录", 401);

      const admin = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
        auth: { persistSession: false },
      });

      return await handler(req, { supabase: admin, userId: data.user.id });
    } catch (e: any) {
      if (e?.message?.includes("环境变量")) return fail(e.message, 500);
      console.error("[API Error]", e);
      return fail(e.message || "服务器内部错误", e?.status || 500);
    }
  };
}