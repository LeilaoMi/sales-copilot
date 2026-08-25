"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { apiFetch } from "@/lib/api-client";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import type { Client, Interaction } from "@/lib/types";

const STAGES: Record<string, string> = {
  lead: "线索", touched: "已接触", proposal: "已出方案",
  negotiation: "谈判中", won: "成交", lost: "失败",
};

const TYPE_LABELS: Record<string, string> = {
  call: "电话", wechat: "微信", meeting: "会面", email: "邮件", other: "其他",
};

export default function Home() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState<"analyze" | "history">("analyze");
  const [form, setForm] = useState({ name: "", title: "", company: "", industry: "", note: "" });
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [detail, setDetail] = useState<(Client & { interactions: Interaction[] }) | null>(null);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // 鉴权守卫（运行时加载配置）
  useEffect(() => {
    let cancelled = false;
    getSupabaseBrowser()
      .then((supabase) => supabase.auth.getSession())
      .then(({ data: { session } }) => {
        if (cancelled) return;
        if (!session) router.replace("/login");
        else setAuthChecked(true);
      })
      .catch(() => setError("服务配置加载失败，请刷新重试"));
    return () => { cancelled = true; };
  }, [router]);

  const loadHistory = useCallback(async (q?: string) => {
    try {
      const res = await apiFetch(`/api/clients${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      if (res.ok) setClients(await res.json());
    } catch { /* 已在 apiFetch 处理 */ }
  }, []);

  useEffect(() => { if (authChecked) loadHistory(); }, [authChecked, loadHistory]);

  // 搜索防抖
  useEffect(() => {
    if (!authChecked) return;
    const t = setTimeout(() => loadHistory(searchQ), 300);
    return () => clearTimeout(t);
  }, [searchQ, authChecked, loadHistory]);

  async function analyze(retryClientId?: string, retryData?: Partial<typeof form>) {
    const payload = retryData ?? form;
    if (!payload.name?.trim()) { setError("客户姓名必填"); return; }
    setLoading(true); setError(""); setReport("");
    abortRef.current = new AbortController();

    try {
      const supabase = await getSupabaseBrowser();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session!.access_token}`,
        },
        body: JSON.stringify({ ...payload, client_id: retryClientId }),
        signal: abortRef.current.signal,
      });

      if (res.status === 401) { router.replace("/login"); return; }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `服务端错误 ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setReport(full);
      }

      // 服务端已入库，刷新历史即可
      loadHistory();
    } catch (e: any) {
      if (e.name !== "AbortError") setError(e.message || "分析失败");
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(id: string) {
    const res = await apiFetch(`/api/clients/${id}`);
    if (res.ok) { setDetail(await res.json()); setTab("history"); }
  }

  async function updateStage(id: string, stage: string) {
    await apiFetch(`/api/clients/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ stage }),
    });
    if (detail && detail.id === id) setDetail({ ...detail, stage: stage as Client["stage"] });
    loadHistory();
  }

  async function deleteClient(id: string) {
    if (!confirm("确定删除该客户及其全部交互记录？此操作不可恢复。")) return;
    await apiFetch(`/api/clients/${id}`, { method: "DELETE" });
    setDetail(null);
    loadHistory();
  }

  async function retryFailed(c: Client) {
    setTab("analyze");
    analyze(c.id, { name: c.name, title: c.title || "", company: c.company || "", industry: c.industry || "", note: c.note || "" });
  }

  async function addInteraction(clientId: string, fd: FormData) {
    const body = {
      client_id: clientId,
      type: fd.get("type"),
      summary: fd.get("summary") || null,
      next_step: fd.get("next_step") || null,
      next_step_time: fd.get("next_step_time") || null,
    };
    const res = await apiFetch("/api/interactions", { method: "POST", body: JSON.stringify(body) });
    if (res.ok) openDetail(clientId);
  }

  function copyReport(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function logout() {
    (await getSupabaseBrowser()).auth.signOut();
    router.replace("/login");
  }

  if (!authChecked) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">加载中…</div>;
  }

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500";

  function statusBadge(s: string) {
    if (s === "generating") return <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">生成中</span>;
    if (s === "failed") return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">失败</span>;
    return null;
  }

  return (
    <main className="max-w-xl mx-auto p-4 pb-24">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">🎯 销售情报官</h1>
        <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-600">退出</button>
      </header>

      <div className="flex bg-gray-100 rounded-lg p-0.5 mb-4">
        <button onClick={() => setTab("analyze")}
          className={`flex-1 py-1.5 rounded-md text-sm ${tab === "analyze" ? "bg-white shadow font-medium" : "text-gray-500"}`}>
          分析
        </button>
        <button onClick={() => { setTab("history"); setDetail(null); }}
          className={`flex-1 py-1.5 rounded-md text-sm ${tab === "history" ? "bg-white shadow font-medium" : "text-gray-500"}`}>
          历史{clients.length > 0 ? `(${clients.length})` : ""}
        </button>
      </div>

      {tab === "analyze" && (
        <>
          <div className="space-y-2 mb-3">
            <input className={inputCls} placeholder="* 客户姓名"
              value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input className={inputCls} placeholder="职位（如：采购总监）"
              value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            <input className={inputCls} placeholder="公司名称"
              value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
            <input className={inputCls} placeholder="行业"
              value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} />
            <textarea className={inputCls} rows={2} placeholder="背景备注（如：老客户介绍，下周三首访）"
              value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
          </div>
          <button onClick={() => analyze()} disabled={loading}
            className="w-full bg-blue-600 text-white rounded-xl py-3.5 font-medium text-base active:bg-blue-700 disabled:bg-gray-400 mb-4">
            {loading ? "生成中…" : "生成作战简报"}
          </button>

          {error && (
            <div className="text-red-600 text-sm mb-3 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => analyze()} className="underline shrink-0 ml-2">重试</button>
            </div>
          )}

          {(report || loading) && (
            <div className="prose-sm border rounded-xl p-4 bg-white shadow-sm relative">
              {loading && !report && <div className="text-gray-400 animate-pulse">正在收集情报…</div>}
              {!loading && report && (
                <button onClick={() => copyReport(report)}
                  className="absolute top-3 right-3 text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded">
                  {copied ? "✓ 已复制" : "复制"}
                </button>
              )}
              <ReactMarkdown>{report}</ReactMarkdown>
            </div>
          )}
        </>
      )}

      {tab === "history" && !detail && (
        <div>
          <input className={`${inputCls} mb-3`} placeholder="搜索姓名 / 公司 / 行业 / 备注"
            value={searchQ} onChange={e => setSearchQ(e.target.value)} />
          <div className="space-y-2">
            {clients.length === 0 && <div className="text-gray-400 text-center py-10">{searchQ ? "无匹配结果" : "暂无记录"}</div>}
            {clients.map(c => (
              <button key={c.id} onClick={() => openDetail(c.id)}
                className="w-full text-left border rounded-xl p-3.5 bg-white shadow-sm active:bg-gray-50">
                <div className="flex justify-between items-center gap-2">
                  <span className="font-medium truncate">{c.name}{c.company ? ` · ${c.company}` : ""}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {statusBadge(c.status)}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      c.stage === "won" ? "bg-green-100 text-green-700" :
                      c.stage === "lost" ? "bg-red-100 text-red-700" :
                      c.stage === "negotiation" ? "bg-orange-100 text-orange-700" :
                      "bg-blue-100 text-blue-700"}`}>
                      {STAGES[c.stage] || c.stage}
                    </span>
                  </div>
                </div>
                {c.next_follow_up && (
                  <div className="text-xs text-orange-600 mt-1">⏰ 跟进: {new Date(c.next_follow_up).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                )}
                <div className="text-xs text-gray-400 mt-1">
                  {[c.title, c.industry].filter(Boolean).join(" · ") || "未填写"} · {new Date(c.created_at).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === "history" && detail && (
        <div>
          <button onClick={() => setDetail(null)} className="text-blue-600 text-sm mb-3">← 返回列表</button>

          {/* 客户信息卡 */}
          <div className="border rounded-xl p-4 bg-white shadow-sm mb-3">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold text-lg">{detail.name}</div>
                <div className="text-sm text-gray-500">{[detail.title, detail.company, detail.industry].filter(Boolean).join(" · ")}</div>
              </div>
              <button onClick={() => deleteClient(detail.id)} className="text-xs text-red-400 hover:text-red-600">删除</button>
            </div>
            {detail.note && <div className="text-sm mt-2 p-2 bg-yellow-50 rounded">📌 {detail.note}</div>}
            {detail.status === "failed" && (
              <button onClick={() => retryFailed(detail)} className="mt-2 w-full text-sm bg-orange-50 text-orange-700 rounded-lg py-2">
                简报生成失败，点击重试
              </button>
            )}
            <div className="flex gap-1.5 mt-3 flex-wrap">
              {Object.entries(STAGES).map(([k, v]) => (
                <button key={k} onClick={() => updateStage(detail.id, k)}
                  className={`text-xs px-2.5 py-1 rounded-full border ${
                    detail.stage === k ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600"}`}>
                  {v}
                </button>
              ))}
            </div>
            {detail.next_follow_up && (
              <div className="text-xs text-orange-600 mt-2">
                ⏰ 下次跟进: {new Date(detail.next_follow_up).toLocaleString("zh-CN")}
              </div>
            )}
          </div>

          {/* 情报报告 */}
          {detail.profile && typeof detail.profile === "string" && (
            <div className="prose-sm border rounded-xl p-4 bg-white shadow-sm mb-3 relative">
              <button onClick={() => copyReport(detail.profile as string)}
                className="absolute top-3 right-3 text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded">
                {copied ? "✓ 已复制" : "复制"}
              </button>
              <ReactMarkdown>{detail.profile}</ReactMarkdown>
            </div>
          )}

          {/* 交互记录 */}
          <h3 className="font-bold text-sm mb-2 mt-4">交互记录 ({detail.interactions.length})</h3>

          {/* 快速添加交互 */}
          <form onSubmit={async (e) => {
            e.preventDefault();
            await addInteraction(detail.id, new FormData(e.currentTarget));
            e.currentTarget.reset();
          }} className="border rounded-xl p-3 bg-gray-50 space-y-2 mb-3">
            <div className="flex gap-2">
              <select name="type" className="border rounded-lg px-2 py-1.5 text-sm flex-1" defaultValue="call">
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input name="next_step_time" type="datetime-local" className="border rounded-lg px-2 py-1.5 text-sm flex-1" title="下次跟进时间（可选）" />
            </div>
            <textarea name="summary" rows={2} placeholder="沟通摘要" className="w-full border rounded-lg px-2 py-1.5 text-sm" />
            <input name="next_step" placeholder="下一步动作（可选）" className="w-full border rounded-lg px-2 py-1.5 text-sm" />
            <button type="submit" className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium active:bg-blue-700">
              记录本次交互
            </button>
          </form>

          {/* 历史交互列表 */}
          <div className="space-y-2">
            {detail.interactions.map(it => (
              <div key={it.id} className="border rounded-xl p-3 bg-white text-sm">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium text-blue-700">{TYPE_LABELS[it.type] || it.type}</span>
                  <span className="text-xs text-gray-400">{new Date(it.created_at).toLocaleString("zh-CN")}</span>
                </div>
                {it.summary && <p className="text-gray-700 whitespace-pre-wrap">{it.summary}</p>}
                {it.next_step && <p className="mt-1 text-orange-600">→ {it.next_step}{it.next_step_time ? ` (${new Date(it.next_step_time).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })})` : ""}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}