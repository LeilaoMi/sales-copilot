import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

// GET /api/clients - 历史列表
export async function GET() {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data || []);
}

// POST /api/clients - 新增客户（含情报报告）
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.name) return Response.json({ error: "name required" }, { status: 400 });

    const { data, error } = await supabase
      .from("clients")
      .insert({
        name: body.name,
        company: body.company || null,
        title: body.title || null,
        industry: body.industry || null,
        note: body.note || null,
        profile: body.report || null,
        stage: "lead",
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}