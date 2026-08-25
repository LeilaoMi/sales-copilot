import { NextRequest } from "next/server";
import { withAuth, fail, ok } from "@/lib/api-utils";
import { embedText, cosineSimilarity } from "@/lib/embedding";
import { streamChat } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST /api/knowledge/advise
// 话术军火：输入客户情境 → 检索知识库 → LLM 生成定制应对话术
// 输入: { situation: 客户说的原话或情境描述 }
// 输出: { references: 命中的知识条目, advice: 定制话术 }
export const POST = withAuth(async (req, { supabase, userId }) => {
  const body = await req.json();
  const situation = String(body.situation || "").trim();
  if (!situation) return fail("请输入客户情境", 400);

  // 1. 检索知识库
  const { data: docs, error } = await supabase
    .from("knowledge_docs")
    .select("id,title,category,content,embedding")
    .eq("user_id", userId)
    .limit(200);

  if (error) return fail(error.message, 500);

  let references: { id: string; title: string; category: string; score?: number }[] = [];
  let contextBlock = "";

  if (docs && docs.length > 0) {
    const queryVec = await embedText(situation);

    if (queryVec) {
      // 向量语义检索 top3
      const scored = docs
        .filter((d) => Array.isArray(d.embedding))
        .map((d) => ({
          id: d.id as string,
          title: d.title as string,
          category: d.category as string,
          content: d.content as string,
          score: cosineSimilarity(queryVec, d.embedding as number[]),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .filter((d) => d.score > 0.35); // 相似度阈值

      references = scored.map(({ content: _c, ...rest }) => rest);
      if (scored.length > 0) {
        contextBlock = `\n\n以下是你的知识库中匹配到的相关经验，优先参考其中的策略和话术风格：\n${scored
          .map((d, i) => `[经验${i + 1}] ${d.title}：\n${d.content.slice(0, 800)}`)
          .join("\n\n")}`;
      }
    }

    // 向量检索无果时关键词兜底
    if (!contextBlock) {
      const kw = docs.filter(
        (d) =>
          d.title.includes(situation.slice(0, 4)) ||
          situation.split(/\s+/).some((w) => w.length > 1 && String(d.content).includes(w))
      ).slice(0, 2);
      if (kw.length > 0) {
        references = kw.map((d) => ({ id: d.id as string, title: d.title as string, category: d.category as string }));
        contextBlock = `\n\n知识库相关参考：\n${kw.map((d) => `[${d.title}] ${(d.content as string).slice(0, 500)}`).join("\n")}`;
      }
    }
  }

  // 2. 生成定制话术
  const prompt = `你是资深销售教练。客户情境如下：
"""
${situation}
"""${contextBlock}

生成应对方案。严格输出以下 JSON（不要代码块包装）：
{
  "analysis": "一句话拆解客户这句话背后的真实顾虑",
  "talking_points": ["3条核心应对要点"],
  "suggested_reply": "一段可直接发送的话术，口语化、有同理心、推进成交，150字以内",
  "follow_up": "发送后如何跟进的一句话建议"
}

规则：
- 有知识库参考时融合其策略但不要照抄
- 无参考时基于通用销售方法论
- 禁止空洞套话`;

  let full = "";
  for await (const chunk of streamChat([{ role: "user", content: prompt }])) {
    full += chunk;
    if (full.length > 3000) break;
  }

  try {
    let jsonStr = full.trim();
    const m = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) jsonStr = m[1].trim();
    const s = jsonStr.indexOf("{");
    const e = jsonStr.lastIndexOf("}");
    if (s === -1 || e === -1) throw new Error("no json");
    const parsed = JSON.parse(jsonStr.slice(s, e + 1));

    return ok({
      references,
      analysis: String(parsed.analysis || ""),
      talking_points: Array.isArray(parsed.talking_points) ? parsed.talking_points.map(String) : [],
      suggested_reply: String(parsed.suggested_reply || ""),
      follow_up: String(parsed.follow_up || ""),
    });
  } catch {
    return fail("AI 返回格式异常，请重试", 502);
  }
});