import { NextRequest } from "next/server";
import { withAuth, fail } from "@/lib/api-utils";
import { streamChat, buildBriefPrompt } from "@/lib/llm";
import { webSearch } from "@/lib/search";

export const runtime = "nodejs";
export const maxDuration = 300; // Vercel 免费档函数上限，防 10s 掐断

export const POST = withAuth(async (req, { supabase, userId }) => {
  const body = await req.json();
  const { client_id, name, title, company, industry, note } = body;

  if (!name || !String(name).trim()) return fail("客户姓名必填", 400);

  // 定位目标客户：已有客户重新生成 / 新客户先建行
  let clientId = client_id as string | undefined;
  if (!clientId) {
    const { data: inserted, error: insErr } = await supabase
      .from("clients")
      .insert({ user_id: userId, name: String(name).trim(), title: title || null, company: company || null, industry: industry || null, note: note || null, stage: "lead", status: "generating" })
      .select("id")
      .single();
    if (insErr) return fail(`创建客户失败: ${insErr.message}`, 500);
    clientId = inserted.id;
  }

  if (!clientId) return fail("客户ID初始化失败", 500);

  // 标记生成中
  await supabase.from("clients").update({ status: "generating" }).eq("id", clientId).eq("user_id", userId);

  // 先联网搜集情报（无 Key 自动降级为纯模型知识模式）
  const search = await webSearch({ name, title, company, industry });
  const prompt = buildBriefPrompt({ name, title, company, industry, note }, search.contextBlock);

  // 流式转发给前端，同时服务端累积全文
  let fullReport = "";
  let hadError = false;
  let errMsg = "";
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamChat([{ role: "user", content: prompt }])) {
          fullReport += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (e: any) {
        hadError = true;
        errMsg = e.message || "模型调用失败";
        controller.enqueue(encoder.encode(`\n\n[错误] ${errMsg}`));
      } finally {
        controller.close();
        // 流结束后统一落库：成功存报告，失败标记 failed
        const patch = hadError
          ? { status: "failed" as const }
          : fullReport.trim()
            ? { profile: fullReport, status: "ready" as const }
            : { status: "failed" as const };
        await supabase.from("clients").update(patch).eq("id", clientId!).eq("user_id", userId);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Client-Id": clientId,
    },
  });
});