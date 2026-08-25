// 文本向量化 - OpenAI 兼容 embeddings 协议
// 复用 LLM_PROVIDER 已配置的通道（如 agnes），零额外依赖
// 灵感致敬: filip-michalsky/SalesGPT (MIT) 的产品知识注入范式
import { getProvider } from "./llm";

const EMBED_DIM = 1536; // text-embedding-3-small 维度
const MAX_CHARS = 6000; // 单条知识上限（超出截断）

export async function embedText(text: string): Promise<number[] | null> {
  try {
    const p = getProvider();
    if (!p.apiKey) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(`${p.baseURL}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.apiKey}` },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.slice(0, MAX_CHARS),
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const data = await res.json();
    const vec = data?.data?.[0]?.embedding;
    if (!Array.isArray(vec) || vec.length !== EMBED_DIM) return null;
    return vec;
  } catch {
    return null; // 向量化失败不阻塞入库，embedding 留空仍可用关键词搜索兜底
  }
}

// 余弦相似度检索（在应用层做 topK 过滤）
export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}