import { NextRequest } from "next/server";
import { withAuth, fail, ok } from "@/lib/api-utils";

export const runtime = "nodejs";

// GET /api/knowledge/leaderboard - 贡献者排行榜（按条目数+被引用次数聚合）
export const GET = withAuth(async (_req, { supabase, userId }) => {
  void userId;
  const { data, error } = await supabase
    .from("knowledge_docs")
    .select("user_id,used_count");

  if (error) return fail(error.message, 500);

  const agg = new Map<string, { docs: number; used: number }>();
  for (const d of data || []) {
    const cur = agg.get(d.user_id) || { docs: 0, used: 0 };
    cur.docs += 1;
    cur.used += d.used_count || 0;
    agg.set(d.user_id, cur);
  }

  // 贡献者展示名（邮箱前缀）
  const { data: users } = await supabase.auth.admin.listUsers();
  const nameMap = new Map<string, string>();
  for (const u of users?.users || []) {
    nameMap.set(u.id, (u.email || "匿名").split("@")[0]);
  }

  const board = Array.from(agg.entries())
    .map(([uid, v]) => ({ contributor: nameMap.get(uid) || "匿名", ...v }))
    .sort((a, b) => b.used - a.used || b.docs - a.docs)
    .slice(0, 10);

  return ok(board);
});