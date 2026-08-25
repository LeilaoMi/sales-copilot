"use client";

// 登录/注册页 - 邮箱魔法链接 + 密码双模式
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);

    try {
      const supabase = await getSupabaseBrowser();
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
        router.push("/");
      } else {
        // 注册：直接建号+登录（个人工具，免邮箱验证）
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw new Error(error.message);
        if (data.session) {
          router.push("/");
        } else {
          // 项目开启了邮箱确认，提示去查收
          setSent(true);
        }
      }
    } catch (e: any) {
      setError(e.message || "操作失败");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-1">🎯 销售情报官</h1>
        <p className="text-center text-gray-400 text-sm mb-6">AI 驱动的销售作战助手</p>

        <div className="bg-white border rounded-xl p-5 shadow-sm">
          <div className="flex bg-gray-100 rounded-lg p-0.5 mb-4">
            <button onClick={() => setMode("signin")}
              className={`flex-1 py-1.5 rounded-md text-sm ${mode === "signin" ? "bg-white shadow font-medium" : "text-gray-500"}`}>
              登录
            </button>
            <button onClick={() => setMode("signup")}
              className={`flex-1 py-1.5 rounded-md text-sm ${mode === "signup" ? "bg-white shadow font-medium" : "text-gray-500"}`}>
              注册
            </button>
          </div>

          {sent ? (
            <div className="text-sm text-green-700 bg-green-50 rounded-lg p-3">
              确认邮件已发送到你的邮箱，请查收后返回登录。
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <input type="email" required placeholder="邮箱" value={email}
                onChange={e => setEmail(e.target.value)} className={inputCls} />
              <input type="password" required minLength={6} placeholder="密码（至少6位）"
                value={password} onChange={e => setPassword(e.target.value)} className={inputCls} />
              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 text-white rounded-lg py-2.5 font-medium active:bg-blue-700 disabled:bg-gray-400">
                {loading ? "处理中…" : mode === "signin" ? "登录" : "注册并进入"}
              </button>
            </form>
          )}

          {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
        </div>
      </div>
    </main>
  );
}