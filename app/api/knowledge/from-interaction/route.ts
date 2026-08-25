import { NextRequest } from "next/server";
import { withAuth, fail, ok } from "@/lib/api-utils";
import { embedText } from "@/lib/embedding";

export const runtime = "nodejs";

// POST /api/knowledge/from-interaction
// 会话→知识沉淀：把一条交互记录提炼为社区知识条目
// body: { interaction_id }
export const POST = withAuth(async (req, { supabase, userId }) => {
  const body = await req.json();
  if (!body.interaction_id) return fail("interaction_id 必填", 400);

  // 取交互记录（校验归属）
  const { data: it, error: e1 } = await supabase
    .from("interactions")
    .select("type,summary,objections,commitments,next_step,raw_content,clients!inner(name,user_id,industry)")
    .eq("id", body.interaction_id)
    .eq("clients.user_id", userId)
    .single();

  if (e1 || !it) return fail("交互记录不存在", 404);

  const clientName = (it.clients as any)?.name || "";
  const industry = (it.clients as any)?.industry || "";

  // 用 LLM 把交互转化为脱敏的通用知识
  const prompt = `你是销售知识库编辑。把下面这条真实交互记录，提炼成一条可复用的通用销售知识。

原始记录：
- 客户行业：${industry || "未知"}
- 沟通类型：${it.type}
- 摘要：${(it.summary || "").slice(0, 300)}
- 客户异议：${Array.isArray(it.objections) ? it.objections.join("；") : "无"}
- 客户承诺：${Array.isArray(it.commitments) ? it.commitments.join("；") : "无"}
- 下一步：${it.next_step || "无"}
- 原始对话片段：${(it.raw_content || "").slice(0, 500) || "无"}

要求：
1. 完全脱敏：不出现真实客户名、公司名、人名（用"客户""某公司"代替）
2. 提炼为通用打法：策略步骤 + 可复用话术 + 禁忌
3. 标题格式：「场景描述」+应对要点（如：客户嫌交期长时的小单分批策略）

严格输出 JSON（不要代码块）：
{"title":"...","content":"...(Markdown，含策略/话术/禁忌三段)"}`;

  let full = "";
  try {
    const { streamChat } = await import("@/lib/llm");
    for await (const chunk of streamChat([{ role: "user", content: prompt }])) {
      full += chunk;
      if (full.length > 3000) break;
    }
  } catch (e: any) {
    return fail(e.message, 502);
  }

  try {
    let jsonStr = full.trim();
    const m = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) jsonStr = m[1].trim();
    const s = jsonStr.indexOf("{");
    const e2 = jsonStr.lastIndexOf("}");
    if (s === -1 || e2 === -1) throw new Error("no json");
    const parsed = JSON.parse(jsonStr.slice(s, e2 + 1));

    const title = String(parsed.title || "").slice(0, 100);
    const content = String(parsed.content || "").slice(0, 6000);
    if (!title || !content) return fail("AI 返回内容不完整，请重试", 502);

    // 入库到全局共享知识库（贡献者为当前用户）
    const embedding = await embedText(`${title}\n${content}`);
    const { data: doc, error: e3 } = await supabase
      .from("knowledge_docs")
      .insert({ user_id: userId, title, category: "case", content, embedding })
      .select("id,title")
      .single();

    if (e3) return fail(e3.message, 500);
    return ok({ doc });
  } catch {
    return fail("AI 返回格式异常，请重试", 502);
  }
});