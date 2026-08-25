"use client";

import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";

type Client = {
  id: string;
  name: string;
  company: string | null;
  title: string | null;
  industry: string | null;
  note: string | null;
  stage: string;
  profile: string | null;
  created_at: string;
};

const STAGES: Record<string, string> = {
  lead: "线索", touched: "已接触", proposal: "已出方案",
  negotiation: "谈判中", won: "成交", lost: "失败",
};

export default function Home() {
  const [tab, setTab] = useState<"analyze" | "history">("analyze");
  const [form, setForm] = useState({ name: "", title: "", company: "", industry: "", note: "" });
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [detail, setDetail] = useState<Client | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/clients");
      if (res.ok) setClients(await res.json());
    } catch { /* 静默 */ }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  async function analyze() {
    if (!form.name.trim()) { setError("客户姓名必填"); return; }
    setLoading(true); setError(""); setReport("");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`服务端错误 ${res.status}`);
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setReport(full);
      }
      // 报告入库
      await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, report: full }),
      });
      loadHistory();
    } catch (e: any) {
      setError(e.message || "分析失败");
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(id: string) {
    const res = await fetch(`/api/clients/${id}`);
    if (res.ok) { setDetail(await res.json()); setTab("history"); }
  }

  async function updateStage(id: string, stage: string) {
    await fetch(`/api/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    if (detail && detail.id === id) setDetail({ ...detail, stage });
    loadHistory();
  }

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <main className="max-w-xl mx-auto p-4 pb-24">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">🎯 销售情报官</h1>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button onClick={() => setTab("analyze")}
            className={`px-4 py-1.5 rounded-md text-sm ${tab === "analyze" ? "bg-white shadow font-medium" : "text-gray-500"}`}>
            分析
          </button>
          <button onClick={() => { setTab("history"); setDetail(null); }}
            className={`px-4 py-1.5 rounded-md text-sm ${tab === "history" ? "bg-white shadow font-medium" : "text-gray-500"}`}>
            历史{clients.length > 0 ? `(${clients.length})` : ""}
          </button>
        </div>
      </header>

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
          <button onClick={analyze} disabled={loading}
            className="w-full bg-blue-600 text-white rounded-xl py-3.5 font-medium text-base active:bg-blue-700 disabled:bg-gray-400 mb-4">
            {loading ? "生成中…" : "生成作战简报"}
          </button>

          {error && <div className="text-red-600 text-sm mb-3">{error}</div>}

          {(report || loading) && (
            <div className="prose-sm border rounded-xl p-4 bg-white shadow-sm">
              {loading && !report && <div className="text-gray-400 animate-pulse">正在收集情报…</div>}
              <ReactMarkdown>{report}</ReactMarkdown>
            </div>
          )}
        </>
      )}

      {tab === "history" && !detail && (
        <div className="space-y-2">
          {clients.length === 0 && <div className="text-gray-400 text-center py-10">暂无记录</div>}
          {clients.map(c => (
            <button key={c.id} onClick={() => openDetail(c.id)}
              className="w-full text-left border rounded-xl p-3.5 bg-white shadow-sm active:bg-gray-50">
              <div className="flex justify-between items-center">
                <span className="font-medium">{c.name}{c.company ? ` · ${c.company}` : ""}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  c.stage === "won" ? "bg-green-100 text-green-700" :
                  c.stage === "lost" ? "bg-red-100 text-red-700" :
                  c.stage === "negotiation" ? "bg-orange-100 text-orange-700" :
                  "bg-blue-100 text-blue-700"}`}>
                  {STAGES[c.stage] || c.stage}
                </span>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {c.industry || "行业未填"} · {new Date(c.created_at).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </div>
            </button>
          ))}
        </div>
      )}

      {tab === "history" && detail && (
        <div>
          <button onClick={() => setDetail(null)} className="text-blue-600 text-sm mb-3">← 返回列表</button>
          <div className="border rounded-xl p-4 bg-white shadow-sm mb-3">
            <div className="font-bold text-lg">{detail.name}</div>
            <div className="text-sm text-gray-500">{[detail.title, detail.company, detail.industry].filter(Boolean).join(" · ")}</div>
            {detail.note && <div className="text-sm mt-2 p-2 bg-yellow-50 rounded">📌 {detail.note}</div>}
            <div className="flex gap-1.5 mt-3 flex-wrap">
              {Object.entries(STAGES).map(([k, v]) => (
                <button key={k} onClick={() => updateStage(detail.id, k)}
                  className={`text-xs px-2.5 py-1 rounded-full border ${
                    detail.stage === k ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600"}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
          {detail.profile && (
            <div className="prose-sm border rounded-xl p-4 bg-white shadow-sm">
              <ReactMarkdown>{typeof detail.profile === "string" ? detail.profile : JSON.stringify(detail.profile)}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </main>
  );
}