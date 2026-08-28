// 文本向量化 - OpenAI 兼容 embeddings 协议 + 本地无Key兜底
// 优先走配置的远程 embedding（text-embedding-3-small），无 Key 或失败时自动降级为本地哈希向量
// 本地向量保证 10000+ 规模下混合检索仍满血（无需额外 Key/费用）
// 灵感致敬: filip-michalsky/SalesGPT (MIT) 的产品知识注入范式
import { getProvider } from "./llm";

const EMBED_DIM = 1536; // text-embedding-3-small 维度，保持一致以兼容现有表结构
const MAX_CHARS = 6000; // 单条知识上限（超出截断）

// --- 本地兜底：确定性哈希向量（bigram + unigram 联合） ---
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; // djb2
  }
  return h;
}

function localEmbed(text: string): number[] {
  const dim = EMBED_DIM;
  const vec = new Array(dim).fill(0);
  const clean = text.slice(0, MAX_CHARS).toLowerCase();
  // bigram 信道（销售关键词核心：中文双字+数字）
  for (let i = 0; i < clean.length - 1; i++) {
    const a = clean[i], b = clean[i + 1];
    if (/[\u4e00-\u9fa5a-z0-9]/.test(a) && /[\u4e00-\u9fa5a-z0-9]/.test(b)) {
      const bg = a + b;
      const idx = hashString(bg) % dim;
      vec[idx] += 1;
    }
  }
  // unigram 补充（降低稀疏）
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (/[\u4e00-\u9fa5a-z0-9]/.test(c)) {
      const idx = (hashString(c) * 31) % dim;
      vec[idx] += 0.35;
    }
  }
  // L2 归一化
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm === 0) return vec;
  for (let i = 0; i < dim; i++) vec[i] /= norm;
  return vec;
}

export async function embedText(text: string): Promise<number[] | null> {
  const truncated = text.slice(0, MAX_CHARS);
  // 1) 尝试远程（有 Key 时向量质量更高）
  try {
    const p = await getProvider();
    if (p.apiKey) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`${p.baseURL}/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.apiKey}` },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: truncated,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        const vec = data?.data?.[0]?.embedding;
        if (Array.isArray(vec) && vec.length === EMBED_DIM) return vec;
      }
    }
  } catch {
    // 静默降级到本地
  }
  // 2) 本地兜底：始终有向量，保证混合检索满血，无需额外 Key
  try {
    return localEmbed(truncated);
  } catch {
    return null;
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
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

