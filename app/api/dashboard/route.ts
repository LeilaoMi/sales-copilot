import { NextRequest } from "next/server";
import { withAuth, fail, ok } from "@/lib/api-utils";

export const runtime = "nodejs";

// GET /api/dashboard - 作战台数据聚合
export const GET = withAuth(async (_req, { supabase, userId }) => {
  const [{ data: clients, error: e1 }, { data: interactions, error: e2 }] = await Promise.all([
    supabase.from("clients").select("id,name,company,stage,status,next_follow_up").eq("user_id", userId),
    supabase
      .from("interactions")
      .select("objections,created_at,client_id,clients!inner(user_id)")
      .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
  ]);

  if (e1) return fail(e1.message, 500);
  if (e2) return fail(e2.message, 500);

  const cs = clients || [];
  const is = interactions || [];

  // 漏斗
  const stageOrder = ["lead", "touched", "proposal", "negotiation", "won", "lost"];
  const funnel = stageOrder.map((stage) => ({ stage, count: cs.filter((c) => c.stage === stage).length }));

  // 本周待跟进（未来7天内）
  const weekEnd = Date.now() + 7 * 86400000;
  const weeklyFollowUps = cs
    .filter((c) => c.next_follow_up && new Date(c.next_follow_up).getTime() <= weekEnd)
    .sort((a, b) => new Date(a.next_follow_up!).getTime() - new Date(b.next_follow_up!).getTime())
    .slice(0, 20)
    .map((c) => ({ id: c.id, name: c.name, company: c.company, next_follow_up: c.next_follow_up!, stage: c.stage }));

  // 近7日交互趋势
  const interactionTrend: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    interactionTrend.push({ date: key.slice(5), count: is.filter((x) => String(x.created_at).slice(0, 10) === key).length });
  }

  // 异议 TOP5（近30天）
  const objectionCount = new Map<string, number>();
  for (const it of is) {
    if (Array.isArray(it.objections)) {
      for (const o of it.objections as string[]) {
        objectionCount.set(o, (objectionCount.get(o) || 0) + 1);
      }
    }
  }
  const objectionTop = Array.from(objectionCount.entries())
    .map(([objection, count]) => ({ objection, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return ok({
    funnel,
    weeklyFollowUps,
    interactionTrend,
    objectionTop,
    totals: {
      clients: cs.length,
      interactions: is.length,
      won: cs.filter((c) => c.stage === "won").length,
      lost: cs.filter((c) => c.stage === "lost").length,
    },
  });
});