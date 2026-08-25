import { NextRequest } from "next/server";
import { withAuth, fail, ok } from "@/lib/api-utils";

export const runtime = "nodejs";

// GET /api/clients/[id] - 客户详情（含交互历史）
export const GET = withAuth(async (req, { supabase, userId }) => {
  const id = req.url.split("/api/clients/")[1]?.split("?")[0] ?? "";
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return fail("无效的客户ID", 400);

  const [{ data: client, error: e1 }, { data: interactions, error: e2 }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).eq("user_id", userId).single(),
    supabase.from("interactions").select("*").eq("client_id", id).order("created_at", { ascending: false }),
  ]);

  if (e1) return fail(e1.code === "PGRST116" ? "客户不存在" : e1.message, e1.code === "PGRST116" ? 404 : 500);
  if (e2) return fail(e2.message, 500);
  return ok({ ...client, interactions: interactions || [] });
});

// PATCH /api/clients/[id] - 更新阶段/备注/跟进时间
export const PATCH = withAuth(async (req, { supabase, userId }) => {
  const id = req.url.split("/api/clients/")[1]?.split("?")[0] ?? "";
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return fail("无效的客户ID", 400);

  const body = await req.json();
  const patch: Record<string, any> = {};
  for (const k of ["stage", "note", "title"]) {
    if (body[k] !== undefined) patch[k] = body[k];
  }
  if (body.next_follow_up !== undefined) {
    // 允许 null 清空，或合法时间字符串
    patch.next_follow_up = body.next_follow_up ? new Date(body.next_follow_up).toISOString() : null;
    if (body.next_follow_up && isNaN(Date.parse(body.next_follow_up))) {
      return fail("跟进时间格式无效", 400);
    }
  }
  if (Object.keys(patch).length === 0) return fail("无可更新字段", 400);

  const { data, error } = await supabase
    .from("clients")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return fail(error.message, 500);
  return ok(data);
});

// DELETE /api/clients/[id] - 删除客户（级联删交互）
export const DELETE = withAuth(async (req, { supabase, userId }) => {
  const id = req.url.split("/api/clients/")[1]?.split("?")[0] ?? "";
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return fail("无效的客户ID", 400);

  const { error } = await supabase.from("clients").delete().eq("id", id).eq("user_id", userId);
  if (error) return fail(error.message, 500);
  return ok({ deleted: true });
});