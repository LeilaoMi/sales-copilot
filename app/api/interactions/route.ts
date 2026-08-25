import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

// POST /api/interactions - 记录一次客户交互
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.client_id || !body.type) {
      return Response.json({ error: "client_id 和 type 必填" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("interactions")
      .insert({
        client_id: body.client_id,
        type: body.type,
        summary: body.summary || null,
        commitments: body.commitments || null,
        objections: body.objections || null,
        next_step: body.next_step || null,
        next_step_time: body.next_step_time || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}