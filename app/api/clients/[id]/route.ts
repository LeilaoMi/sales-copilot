import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

// GET /api/clients/[id] - 客户详情（含交互历史）
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const [{ data: client, error: e1 }, { data: interactions, error: e2 }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", id).single(),
    supabase.from("interactions").select("*").eq("client_id", id).order("created_at", { ascending: false }),
  ]);

  if (e1) return Response.json({ error: e1.message }, { status: 404 });
  if (e2) return Response.json({ error: e2.message }, { status: 500 });
  return Response.json({ ...client, interactions: interactions || [] });
}

// PATCH /api/clients/[id] - 更新阶段/跟进时间等
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const patch: Record<string, any> = {};
  for (const k of ["stage", "next_follow_up", "note", "title"]) {
    if (body[k] !== undefined) patch[k] = body[k];
  }
  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "无可更新字段" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("clients")
    .update(patch)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}