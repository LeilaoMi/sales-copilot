import { NextRequest } from "next/server";
import { withAuth, fail, ok } from "@/lib/api-utils";
import { embedText } from "@/lib/embedding";

export const runtime = "nodejs";

const VALID_CATS = ["objection", "faq", "competitor", "case", "script", "other"];

// GET /api/knowledge?q=关键词&industry=行业&page=1&limit=200 - 10000规模分页支持
// 默认 500/页，上限 2000，兼容旧前端（不传 page/limit 仍返回 500）
export const GET = withAuth(async (req, { supabase, userId }) => {
  void userId;
  const params = new URL(req.url).searchParams;
  const q = params.get("q")?.trim();
  const industry = params.get("industry")?.trim();
  const page = Math.max(1, parseInt(params.get("page") || "1", 10) || 1);
  const limit = Math.min(2000, Math.max(1, parseInt(params.get("limit") || "500", 10) || 500));
  const offset = (page - 1) * limit;

  let query = supabase
    .from("knowledge_docs")
    .select("id,title,category,content,created_at,industry_tags,used_count,user_id")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (q) {
    const safeQ = q.replace(/[,()"']/g, "");
    query = query.or(`title.ilike.%${safeQ}%,content.ilike.%${safeQ}%`);
  }
  if (industry) {
    query = query.filter("industry_tags", "cs", `{${industry.replace(/[,()"']/g, "")}}`);
  }

  const { data, error } = await query;
  if (error) return fail(error.message, 500);
  return ok(data || []);
});

// POST /api/knowledge - 新增知识条目（自动向量化，支持行业标签）
export const POST = withAuth(async (req, { supabase, userId }) => {
  const body = await req.json();
  if (!body.title?.trim()) return fail("标题必填", 400);
  if (!body.content?.trim()) return fail("内容必填", 400);
  if (!VALID_CATS.includes(body.category)) return fail(`category 必须是: ${VALID_CATS.join("/")}`, 400);
  if (body.content.length > 6000) return fail("内容过长（6000字以内）", 400);

  let industryTags: string[] = [];
  if (Array.isArray(body.industry_tags)) {
    industryTags = body.industry_tags.map((t: any) => String(t).trim()).filter(Boolean).slice(0, 5);
  } else if (typeof body.industry_tags === "string") {
    industryTags = body.industry_tags.split(/[,，、\s]+/).map((t: any) => t.trim()).filter(Boolean).slice(0, 5);
  }

  const embedding = await embedText(`${body.title}\n${body.content}`);

  const { data, error } = await supabase
    .from("knowledge_docs")
    .insert({
      user_id: userId,
      title: String(body.title).trim(),
      category: body.category,
      content: String(body.content).trim(),
      embedding,
      industry_tags: industryTags,
    })
    .select("id,title,category,created_at")
    .single();

  if (error) return fail(error.message, 500);
  return ok(data);
});
