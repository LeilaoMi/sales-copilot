import { NextRequest } from "next/server";
import { withAuth, fail, ok } from "@/lib/api-utils";

export const runtime = "nodejs";

// GET /api/clients?q=关键词 - 当前用户的历史客户（支持搜索）
export const GET = withAuth(async (req, { supabase, userId }) => {
  const q = new URL(req.url).searchParams.get("q")?.trim();

  let query = supabase
    .from("clients")
    .select("id,name,title,company,industry,stage,status,profile,next_follow_up,note,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (q) {
    // 防 PostgREST 过滤器注入：剔除保留字符
    const safeQ = q.replace(/[,()"']/g, "");
    // 搜姓名/公司/行业/备注
    query = query.or(`name.ilike.%${safeQ}%,company.ilike.%${safeQ}%,industry.ilike.%${safeQ}%,note.ilike.%${safeQ}%`);
  }

  const { data, error } = await query;
  if (error) return fail(error.message, 500);
  return ok(data || []);
});

// POST /api/clients - 手动添加客户（不走 AI 分析）
export const POST = withAuth(async (req, { supabase, userId }) => {
  const body = await req.json();
  if (!body.name?.trim()) return fail("客户姓名必填", 400);

  const { data, error } = await supabase
    .from("clients")
    .insert({
      user_id: userId,
      name: String(body.name).trim(),
      title: body.title || null,
      company: body.company || null,
      industry: body.industry || null,
      note: body.note || null,
      stage: "lead",
      status: "ready", // 手动添加无报告，直接就绪态
    })
    .select()
    .single();

  if (error) return fail(error.message, 500);
  return ok(data);
});