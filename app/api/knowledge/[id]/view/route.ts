import { NextRequest } from "next/server";
import { withAuth, fail, ok } from "@/lib/api-utils";

export const runtime = "nodejs";

// GET /api/knowledge/[id] - 知识条目全文（登录即可读，全局共享）
export const GET = withAuth(async (req, { supabase, userId }) => {
  void userId;
  const id = req.url.split("/api/knowledge/")[1]?.split("?")[0] ?? "";
  // 剥掉 /view 后缀
  const cleanId = id.replace(/\/view$/, "");
  if (!cleanId || !/^[0-9a-f-]{36}$/i.test(cleanId)) return fail("无效的ID", 400);

  const { data, error } = await supabase
    .from("knowledge_docs")
    .select("id,title,category,content,created_at")
    .eq("id", cleanId)
    .single();

  if (error) return fail("条目不存在", 404);
  return ok(data);
});