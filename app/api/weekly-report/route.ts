import { NextRequest } from "next/server";
import { withAuth, fail, ok } from "@/lib/api-utils";

export const runtime = "nodejs";

// POST /api/weekly-report - AI 周报生成
// 汇总本周客户动态、交互、异议，输出复盘报告
export const POST = withAuth(async (_req, { supabase, userId }) => {
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const [{ data: clients }, { data: interactions }] = await Promise.all([
    supabase.from("clients").select("name,company,stage,status,created_at,next_follow_up").eq("user_id", userId),
    supabase
      .from("interactions")
      .select("type,summary,objections,commitments,created_at,clients!inner(name,user_id)")
      .eq("clients.user_id", userId)
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: false }),
  ]);

  const cs = clients || [];
  const is = interactions || [];

  const newClientsThisWeek = cs.filter((c) => c.created_at >= weekAgo);
  const wonCount = cs.filter((c) => c.stage === "won").length;
  const lostCount = cs.filter((c) => c.stage === "lost").length;
  const pendingFollowUps = cs.filter(
    (c) => c.next_follow_up && new Date(c.next_follow_up) <= new Date(Date.now() + 7 * 86400000)
  );

  // 汇总本周异议
  const objections: string[] = [];
  for (const it of is) {
    if (Array.isArray(it.objections)) objections.push(...(it.objections as string[]));
  }

  const prompt = `你是销售团队的资深复盘教练。基于以下本周数据，生成一份周报复盘。

## 本周数据
- 新增客户：${newClientsThisWeek.length} 人${newClientsThisWeek.length > 0 ? `（${newClientsThisWeek.map((c) => c.name).join("、")}）` : ""}
- 本周交互：${is.length} 次
- 累计成交：${wonCount} 单 | 丢单：${lostCount} 单
- 未来7天待跟进：${pendingFollowUps.length} 位客户

## 本周交互明细
${is.slice(0, 20).map((it: any) => `- [${(it.clients as any)?.name || "?"}] ${it.type}：${(it.summary || "").slice(0, 60)}${Array.isArray(it.objections) && it.objections.length ? `（异议:${(it.objections as string[]).join("、")}）` : ""}`).join("\n") || "（本周暂无交互记录）"}

## 本周高频异议
${objections.slice(0, 10).join("；") || "（无）"}

严格按以下 Markdown 结构输出，内容具体、有洞察、直接可执行：

# 📊 销售周报（${new Date().toLocaleDateString("zh-CN",{month:"numeric",day:"numeric"})}）

## 一、本周核心动作回顾
（基于交互明细，总结本周做了什么、重点在哪）

## 二、数据解读
（漏斗健康度、转化效率的判断，指出异常）

## 三、问题与风险
（哪些单卡住了？为什么？有什么风险信号？）

## 四、下周行动清单
（3-5条具体行动，每条带明确目标和优先级）

## 五、一句话总结
（给本周的自己一句话评价）`;

  let full = "";
  try {
    const { streamChat } = await import("@/lib/llm");
    for await (const chunk of streamChat([{ role: "user", content: prompt }])) {
      full += chunk;
    }
  } catch (e: any) {
    return fail(e.message || "生成失败", 502);
  }

  return ok({ report: full });
});