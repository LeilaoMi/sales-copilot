import { NextRequest } from "next/server";
import { withAuth, fail, ok } from "@/lib/api-utils";

export const runtime = "nodejs";

// PATCH /api/knowledge/[id] - 更新知识条目
export const PATCH = withAuth(async (req, { supabase, userId }) => {
  const id = req.url.split("/api/knowledge/")[1]?.split("?")[0] ?? "";
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return fail("无效的ID", 400);

  const body = await req.json();
  const patch: Record<string, unknown> = {};
  if (body.title !== undefined) {
    if (!String(body.title).trim()) return fail("标题不能为空", 400);
    patch.title = String(body.title).trim();
  }
  if (body.content !== undefined) {
    if (!String(body.content).trim()) return fail("内容不能为空", 400);
    if (String(body.content).length > 6000) return fail("内容过长", 400);
    patch.content = String(body.content).trim();
    // 内容变了，embedding 需要重新生成（异步标记，下次检索时懒更新）
    patch.embedding = null;
  }
  if (body.category !== undefined) {
    const VALID = ["objection", "faq", "competitor", "case", "script", "other"];
    if (!VALID.includes(body.category)) return fail("无效分类", 400);
    patch.category = body.category;
  }
  if (Object.keys(patch).length === 0) return fail("无可更新字段", 400);

  const { data, error } = await supabase
    .from("knowledge_docs")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select("id,title,category,content")
    .single();

  if (error) return fail(error.message, 500);
  return ok(data);
});

// DELETE /api/knowledge/[id]
export const DELETE = withAuth(async (req, { supabase, userId }) => {
  const id = req.url.split("/api/knowledge/")[1]?.split("?")[0] ?? "";
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return fail("无效的ID", 400);

  const { error } = await supabase
    .from("knowledge_docs")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return fail(error.message, 500);
  return ok({ deleted: true });
});