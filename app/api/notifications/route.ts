import { NextRequest, NextResponse } from "next/server";
import { withAuth, fail } from "@/lib/api-utils";

export const runtime = "nodejs";

// GET /api/notifications - 跟进提醒轮询接口（PWA 前端定时拉取）
// 返回未来 48 小时内到期 + 已过期未跟进的客户
export const GET = withAuth(async (_req: NextRequest, { supabase, userId }) => {
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 3600000);

  const { data, error } = await supabase
    .from("clients")
    .select("id,name,company,next_follow_up,stage")
    .eq("user_id", userId)
    .not("next_follow_up", "is", null)
    .lte("next_follow_up", in48h.toISOString())
    .order("next_follow_up", { ascending: true })
    .limit(50);

  if (error) return fail(error.message, 500);

  return (NextResponse as any).json({
    due: (data || []).filter((c: any) => new Date(c.next_follow_up) <= now),
    upcoming: (data || []).filter((c: any) => new Date(c.next_follow_up) > now),
  });
});