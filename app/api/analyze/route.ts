import { streamChat, buildBriefPrompt } from "@/lib/llm";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { name, title, company, industry, note, language } = await req.json();

  if (!name || !name.trim()) {
    return Response.json({ error: "客户姓名不能为空" }, { status: 400 });
  }

  const prompt = buildBriefPrompt({ name, title, company, industry, note, language });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamChat([{ role: "user", content: prompt }])) {
          controller.enqueue(new TextEncoder().encode(chunk));
        }
      } catch (e: any) {
        controller.enqueue(new TextEncoder().encode(`\n\n[错误] ${e.message}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}