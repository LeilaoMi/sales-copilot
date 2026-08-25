import { NextRequest } from "next/server";
import { withAuth, fail, ok } from "@/lib/api-utils";
import { streamChat } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 300;

// POST /api/interactions/parse
// 会话情报员：粘贴聊天记录（或截图OCR文本）→ LLM 结构化提取
// 输入: { text: 聊天原文 }
// 输出: { summary, commitments[], objections[], next_step, next_step_time, reply_suggestion }
export const POST = withAuth(async (req, { userId }) => {
  void userId;
  const body = await req.json();
  const text = String(body.text || "").trim();
  if (!text) return fail("聊天内容不能为空", 400);
  if (text.length > 8000) return fail("内容过长，请截取关键对话（8000字以内）", 400);

  // 意图识别：是否包含明确的下一步约定
  const prompt = `你是销售会话情报分析引擎。分析以下销售与客户的对话记录，提取结构化情报。

对话记录：
"""
${text}
"""

严格输出以下 JSON（不要 markdown 代码块包装，不要任何解释文字）：
{
  "summary": "3句话以内的沟通摘要，突出核心议题和客户态度",
  "commitments": ["客户做出的具体承诺，如'周三前发预算申请'；没有则空数组"],
  "objections": ["客户表达的疑虑/异议，如'价格比竞品贵20%'；没有则空数组"],
  "next_step": "销售人员应该做的下一步动作，一句话；对话中无明确约定则为空字符串",
  "next_step_time": "客户提到的明确时间点(ISO格式如2026-09-01T15:00:00+08:00)；无明确时间则为null",
  "reply_suggestion": "基于对话语境，给销售的下一条回复建议话术，100字以内，口语化可直接发送"
}

规则：
- 只提取对话中真实存在的信息，禁止脑补
- 时间不确定就填 null，不要猜
- 客户的犹豫、比较竞品、嫌贵都算 objections`;

  // 非流式调用（JSON 输出需要完整结果）
  let full = "";
  for await (const chunk of streamChat([{ role: "user", content: prompt }])) {
    full += chunk;
    if (full.length > 4000) break; // 安全上限
  }

  // 解析 JSON（容错：剥掉可能的代码块包装）
  try {
    let jsonStr = full.trim();
    const m = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) jsonStr = m[1].trim();
    const start = jsonStr.indexOf("{");
    const end = jsonStr.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("no json found");
    const parsed = JSON.parse(jsonStr.slice(start, end + 1));

    return ok({
      summary: String(parsed.summary || ""),
      commitments: Array.isArray(parsed.commitments) ? parsed.commitments.map(String) : [],
      objections: Array.isArray(parsed.objections) ? parsed.objections.map(String) : [],
      next_step: String(parsed.next_step || ""),
      next_step_time: parsed.next_step_time || null,
      reply_suggestion: String(parsed.reply_suggestion || ""),
      raw_content: text,
    });
  } catch {
    return fail("AI 返回格式异常，请重试或手动填写", 502);
  }
});