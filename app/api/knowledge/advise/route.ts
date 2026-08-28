import { NextRequest } from "next/server";
import { withAuth, fail, ok } from "@/lib/api-utils";
import { embedText, cosineSimilarity } from "@/lib/embedding";
import { streamChat } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST /api/knowledge/advise
// 话术军火：输入客户情境 → 检索知识库 → LLM 生成定制应对话术
// 10000规模：检索 2000 条 + 混合评分（本地向量兜底，无需 embedding Key 也满血）
export const POST = withAuth(async (req, { supabase, userId }) => {
  const body = await req.json();
  const situation = String(body.situation || "").trim();
  if (!situation) return fail("请输入客户情境", 400);

  // 1. 检索知识库（全局共享）— 10000 规模取 2000 条候选
  const { data: docs, error } = await supabase
    .from("knowledge_docs")
    .select("id,title,category,content,embedding")
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) return fail(error.message, 500);

  // 懒加载向量化：本地兜底下每次最多补 20 条（无 Key 也能自愈）
  if (docs && docs.length > 0) {
    const missing = docs.filter((d) => !Array.isArray(d.embedding)).slice(0, 20);
    for (const d of missing) {
      const vec = await embedText(`${d.title}\n${String(d.content).slice(0, 2000)}`);
      if (vec) {
        await supabase.from("knowledge_docs").update({ embedding: vec }).eq("id", d.id);
        (d as any).embedding = vec;
      }
    }
  }

  let references: { id: string; title: string; category: string; score?: number }[] = [];
  let contextBlock = "";

  function extractGrams(text: string): Set<string> {
    const clean = text.replace(/[，。！？、\s]/g, "");
    const grams = new Set<string>();
    for (let i = 0; i < clean.length - 1; i++) {
      if (/[\u4e00-\u9fa5a-zA-Z0-9]/.test(clean[i]) && /[\u4e00-\u9fa5a-zA-Z0-9]/.test(clean[i + 1])) {
        grams.add(clean.slice(i, i + 2));
      }
    }
    return grams;
  }

  if (docs && docs.length > 0) {
    interface ScoredDoc {
      id: string;
      title: string;
      category: string;
      content: string;
      vectorScore: number;
      kwHits: number;
      kwNorm: number;
      score: number;
    }
    const situationGrams = extractGrams(situation);
    const queryVec = await embedText(situation); // 本地兜底保证始终有向量

    const scoredDocs: ScoredDoc[] = docs.map((d) => {
      let vectorScore = 0;
      if (queryVec && Array.isArray(d.embedding)) {
        vectorScore = cosineSimilarity(queryVec, d.embedding as number[]);
        // 本地哈希向量的余弦集中在 0.2-0.6 区间，线性映射到 0-1 提升区分度
        vectorScore = Math.max(0, (vectorScore - 0.15) / 0.45);
      }
      const titleClean = String(d.title).replace(/[\s\*\#]/g, "");
      const bodyClean = String(d.content).replace(/[\s\*\#]/g, "");
      let titleHits = 0;
      let bodyHits = 0;
      situationGrams.forEach((g) => {
        if (titleClean.includes(g)) titleHits++;
        else if (bodyClean.includes(g)) bodyHits++;
      });
      const kwHits = titleHits * 2 + bodyHits;
      const kwNorm = Math.min(kwHits / Math.max(situationGrams.size * 0.2, 6), 1);
      return {
        id: d.id as string,
        title: d.title as string,
        category: d.category as string,
        content: d.content as string,
        vectorScore,
        kwHits,
        kwNorm,
        score: vectorScore * 0.5 + kwNorm * 0.5,
      };
    });

    // 混合检索 Top3
    const top3 = [...scoredDocs]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .filter((d) => d.score > 0.18);

    if (top3.length > 0) {
      references = top3.map(({ content: _c, ...rest }) => rest);
      contextBlock = `\n\n以下是你的知识库中匹配到的相关经验（按相关度排序），优先参考排位靠前的策略和话术风格：\n${top3
        .map((d, i) => `[经验${i + 1}] ${d.title}：\n${d.content.slice(0, 800)}`)
        .join("\n\n")}`;
    }

    // 兜底：关键词命中
    if (references.length === 0) {
      const kwFallback = [...scoredDocs]
        .filter((x) => x.kwHits >= 2)
        .sort((a, b) => b.kwHits - a.kwHits)
        .slice(0, 2);
      if (kwFallback.length > 0) {
        references = kwFallback.map((x) => ({ id: x.id, title: x.title, category: x.category, score: x.score }));
        contextBlock = `\n\n知识库相关参考（关键词匹配）：\n${kwFallback
          .map((x, i) => `[参考${i + 1}] ${x.title}：\n${String(x.content).slice(0, 600)}`)
          .join("\n\n")}`;
      }
    }

    if (references.length > 0) {
      for (const r of references) {
        try {
          const { data: cur } = await supabase.from("knowledge_docs").select("used_count").eq("id", r.id).single();
          await supabase.from("knowledge_docs").update({ used_count: (cur?.used_count || 0) + 1 }).eq("id", r.id);
        } catch {}
      }
    }
  }

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
