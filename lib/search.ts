// 联网搜索模块 - Tavily API
// 灵感致敬: mayooear/ai-company-researcher (MIT) 的 search-then-synthesize 管线
// 无 Key 时优雅降级为纯模型知识模式，不阻塞主流程
import { optionalEnv } from "./env";

export interface SearchContext {
  enabled: boolean;
  contextBlock: string; // 拼进 prompt 的情报块（无结果时为空串）
}

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
}

export async function webSearch(client: {
  name?: string;
  title?: string;
  company?: string;
  industry?: string;
}): Promise<SearchContext> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return { enabled: false, contextBlock: "" };
  }

  const maxResults = Math.min(Math.max(Number(optionalEnv("SEARCH_MAX_RESULTS", "5")) || 5, 1), 10);
  // 双查询：公司精确情报 + 行业动态
  const queries: string[] = [];
  if (client.company) queries.push(`${client.company} 公司 业务 新闻`);
  if (client.industry) queries.push(`${client.industry} 行业 2026 趋势 痛点`);

  const allResults: TavilyResult[] = [];
  for (const q of queries.slice(0, 2)) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query: q,
          max_results: maxResults,
          include_answer: false,
          search_depth: "basic",
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) continue;
      const data = await res.json();
      allResults.push(...(data.results || []).slice(0, maxResults));
    } catch {
      // 单条查询失败不影响另一条
    }
  }

  // 去重 + 截断（防 prompt 膨胀）
  const seen = new Set<string>();
  const snippets = allResults
    .filter((r) => {
      const key = r.url || r.title || "";
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxResults * 2)
    .map((r, i) => `[${i + 1}] ${r.title}\n来源: ${r.url}\n摘要: ${(r.content || "").slice(0, 300)}`);

  if (snippets.length === 0) {
    return { enabled: true, contextBlock: "" };
  }

  const contextBlock = `\n\n## 联网搜集的实时情报（生成时请优先采信，并标注不确定处）
${snippets.join("\n\n")}`;
  return { enabled: true, contextBlock };
}