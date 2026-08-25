import { NextRequest } from "next/server";
import { withAuth, fail, ok } from "@/lib/api-utils";

export const runtime = "nodejs";

// POST /api/interactions - 记录一次客户交互
export const POST = withAuth(async (req, { supabase, userId }) => {
  const body = await req.json();
  if (!body.client_id || !body.type) return fail("client_id 和 type 必填", 400);
  const VALID_TYPES = ["call", "wechat", "meeting", "email", "other"];
  if (!VALID_TYPES.includes(body.type)) return fail(`type 必须是: ${VALID_TYPES.join("/")}`, 400);

  // 校验客户归属
  const { data: client, error: cErr } = await supabase
    .from("clients")
    .select("id")
    .eq("id", body.client_id)
    .eq("user_id", userId)
    .single();
  if (cErr || !client) return fail("客户不存在", 404);

  const nextStepTime = body.next_step_time ? new Date(body.next_step_time).toISOString() : null;
  if (body.next_step_time && isNaN(Date.parse(body.next_step_time))) {
    return fail("时间格式无效", 400);
  }

  const { data, error } = await supabase
    .from("interactions")
    .insert({
      client_id: body.client_id,
      type: body.type,
      summary: body.summary || null,
      commitments: Array.isArray(body.commitments) ? body.commitments : null,
      objections: Array.isArray(body.objections) ? body.objections : null,
      next_step: body.next_step || null,
      next_step_time: nextStepTime,
    })
    .select()
    .single();

  if (error) return fail(error.message, 500);

  // 同步回写客户的下次跟进时间
  if (nextStepTime) {
    await supabase.from("clients").update({ next_follow_up: nextStepTime }).eq("id", body.client_id).eq("user_id", userId);
  }

  return ok(data);
});