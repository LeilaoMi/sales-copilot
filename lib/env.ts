// 环境变量集中校验 - 缺配置时给出人话报错，不再神秘失败
export function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v || !v.trim()) {
    throw new Error(`环境变量 ${key} 未配置。请在 Vercel 项目设置或本地 .env.local 中补充。`);
  }
  return v;
}

// 可选变量（带默认值）
export function optionalEnv(key: string, fallback: string): string {
  const v = process.env[key];
  return v && v.trim() ? v.trim() : fallback;
}