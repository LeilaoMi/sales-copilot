"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { apiFetch, startFollowUpNotifier } from "@/lib/api-client";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import type { Client, Interaction } from "@/lib/types";

const STAGES: Record<string, string> = {
  lead: "线索", touched: "已接触", proposal: "已出方案",
  negotiation: "谈判中", won: "成交", lost: "失败",
};
const TYPE_LABELS: Record<string, string> = {
  call: "电话", wechat: "微信", meeting: "会面", email: "邮件", other: "其他",
};
const CAT_LABELS: Record<string, string> = {
  objection: "异议应对", faq: "产品FAQ", competitor: "竞品对比",
  case: "成功案例", script: "标准话术", other: "综合认知",
};

type ParsedInteraction = {
  summary: string;
  commitments: string[];
  objections: string[];
  next_step: string;
  next_step_time: string | null;
  reply_suggestion: string;
  raw_content?: string;
};

type Advice = {
  references: { id: string; title: string; category: string }[];
  analysis: string;
  talking_points: string[];
  suggested_reply: string;
  follow_up: string;
};

type DashboardData = {
  funnel: { stage: string; count: number }[];
  weeklyFollowUps: { id: string; name: string; company: string | null; next_follow_up: string; stage: string }[];
  interactionTrend: { date: string; count: number }[];
  objectionTop: { objection: string; count: number }[];
  totals: { clients: number; interactions: number; won: number; lost: number };
};

const card = "bg-white/80 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-[0_1px_3px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]";

function StageBadge({ stage }: { stage: string }) {
  const styles: Record<string, string> = {
    lead: "bg-violet-50 text-violet-700 ring-violet-600/20",
    touched: "bg-blue-50 text-blue-700 ring-blue-600/20",
    proposal: "bg-cyan-50 text-cyan-700 ring-cyan-600/20",
    negotiation: "bg-amber-50 text-amber-700 ring-amber-600/20",
    won: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    lost: "bg-slate-100 text-slate-500 ring-slate-500/20",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[stage] || styles.lead}`}>
      {STAGES[stage] || stage}
    </span>
  );
}

export default function Home() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState<"dashboard" | "analyze" | "history" | "knowledge">("dashboard");
  const [error, setError] = useState("");
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [form, setForm] = useState({ name: "", title: "", company: "", industry: "", note: "" });
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [detail, setDetail] = useState<(Client & { interactions: Interaction[] }) | null>(null);
  const [copiedId, setCopiedId] = useState("");
  const [showParseModal, setShowParseModal] = useState(false);
  const [chatText, setChatText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedInteraction | null>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [kQ, setKQ] = useState("");
  const [kForm, setKForm] = useState({ title: "", category: "objection", content: "" });
  const [kEditing, setKEditing] = useState<any>(null);
  const [viewDoc, setViewDoc] = useState<any>(null);
  const [situation, setSituation] = useState("");
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [advice, setAdvice] = useState<Advice | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [llmCfg, setLlmCfg] = useState<{ provider: string; model: string; hasKey: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSupabaseBrowser()
      .then((s) => s.auth.getSession())
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
    } catch {}
  }, []);

  const loadKnowledge = useCallback(async (q?: string) => {
    try {
      const res = await apiFetch(`/api/knowledge${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      if (res.ok) setDocs(await res.json());
    } catch {}
  }, []);

  const loadDashboard = useCallback(async () => {
    setDashLoading(true);
    try {
      const res = await apiFetch("/api/dashboard");
      if (res.ok) setDash(await res.json());
    } catch {} finally { setDashLoading(false); }
  }, []);

  useEffect(() => { if (authChecked) { loadHistory(); loadDashboard(); } }, [authChecked, loadHistory, loadDashboard]);
  useEffect(() => { if (authChecked && tab === "history") loadHistory(searchQ); }, [searchQ, authChecked, tab, loadHistory]);
  useEffect(() => { if (authChecked && tab === "knowledge") loadKnowledge(kQ); }, [kQ, authChecked, tab, loadKnowledge]);

  // 跟进提醒：请求通知权限 + 启动轮询
  useEffect(() => {
    if (!authChecked) return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    startFollowUpNotifier((items) => {
      if (items.length > 0) loadDashboard();
    });
  }, [authChecked, loadDashboard]);

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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session!.access_token}` },
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
      loadHistory(); loadDashboard();
    } catch (e: any) {
      if (e.name !== "AbortError") setError(e.message || "分析失败");
    } finally { setLoading(false); }
  }

  async function parseChat() {
    if (!chatText.trim()) return;
    setParsing(true); setParsed(null);
    try {
      const res = await apiFetch("/api/interactions/parse", { method: "POST", body: JSON.stringify({ text: chatText }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "解析失败");
      setParsed(j);
    } catch (e: any) { setError(e.message); } finally { setParsing(false); }
  }

  async function saveParsedToInteraction() {
    if (!parsed || !detail) return;
    await apiFetch("/api/interactions", {
      method: "POST",
      body: JSON.stringify({
        client_id: detail.id, type: "wechat", summary: parsed.summary,
        commitments: parsed.commitments, objections: parsed.objections,
        next_step: parsed.next_step, next_step_time: parsed.next_step_time, raw_content: parsed.raw_content,
      }),
    });
    setShowParseModal(false); setChatText(""); setParsed(null);
    openDetail(detail.id); loadDashboard();
  }

  async function openDetail(id: string) {
    const res = await apiFetch(`/api/clients/${id}`);
    if (res.ok) { setDetail(await res.json()); setTab("history"); }
  }

  async function updateStage(id: string, stage: string) {
    await apiFetch(`/api/clients/${id}`, { method: "PATCH", body: JSON.stringify({ stage }) });
    if (detail && detail.id === id) setDetail({ ...detail, stage: stage as Client["stage"] });
    loadHistory(); loadDashboard();
  }

  async function deleteClient(id: string) {
    if (!confirm("确定删除该客户及其全部交互记录？不可恢复。")) return;
    await apiFetch(`/api/clients/${id}`, { method: "DELETE" });
    setDetail(null); loadHistory(); loadDashboard();
  }

  async function retryFailed(c: Client) {
    setTab("analyze");
    analyze(c.id, { name: c.name, title: c.title || "", company: c.company || "", industry: c.industry || "", note: c.note || "" });
  }

  async function saveDoc() {
    if (!kForm.title.trim() || !kForm.content.trim()) return;
    if (kEditing) {
      await apiFetch(`/api/knowledge/${kEditing.id}`, { method: "PATCH", body: JSON.stringify(kForm) });
    } else {
      const res = await apiFetch("/api/knowledge", { method: "POST", body: JSON.stringify(kForm) });
      if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error || "保存失败"); return; }
    }
    setKForm({ title: "", category: "objection", content: "" }); setKEditing(null); loadKnowledge();
  }

  async function editDoc(d: any) {
    setKEditing(d);
    setKForm({ title: d.title, category: d.category, content: d.content || "" });
    window.scrollTo({ top: 0 });
  }

  async function deleteDoc(id: string) {
    if (!confirm("删除这条知识？")) return;
    await apiFetch(`/api/knowledge/${id}`, { method: "DELETE" });
    loadKnowledge();
  }

  async function viewDocFull(id: string) {
    const res = await apiFetch(`/api/knowledge/${id}/view`);
    if (res.ok) setViewDoc(await res.json());
  }

  async function openSettings() {
    setShowSettings(true); setSettingsLoading(true);
    try {
      const res = await apiFetch("/api/llm-config");
      if (res.ok) setLlmCfg(await res.json());
    } catch {} finally { setSettingsLoading(false); }
  }

  async function saveLlmConfig(provider: string, apiKey: string, model?: string) {
    const res = await apiFetch("/api/llm-config", { method: "POST", body: JSON.stringify({ provider, apiKey, model }) });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || "保存失败");
    const cfgRes = await apiFetch("/api/llm-config");
    if (cfgRes.ok) setLlmCfg(await cfgRes.json());
  }

  // ===== AI 周报 =====
  const [showWeekly, setShowWeekly] = useState(false);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyReport, setWeeklyReport] = useState("");

  async function genWeeklyReport() {
    setShowWeekly(true); setWeeklyLoading(true); setWeeklyReport("");
    try {
      const res = await apiFetch("/api/weekly-report", { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "生成失败");
      setWeeklyReport(j.report);
    } catch (e: any) { setError(e.message); setShowWeekly(false); }
    finally { setWeeklyLoading(false); }
  }

  // ===== 会话→知识沉淀 =====
  const [distillingId, setDistillingId] = useState("");

  async function distillToKnowledge(interactionId: string) {
    if (!confirm("将此交互提炼为社区共享知识（自动脱敏）？")) return;
    setDistillingId(interactionId);
    try {
      const res = await apiFetch("/api/knowledge/from-interaction", {
        method: "POST", body: JSON.stringify({ interaction_id: interactionId }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "沉淀失败");
      alert(`✓ 已入库：《${j.doc?.title}》`);
    } catch (e: any) { setError(e.message); }
    finally { setDistillingId(""); }
  }

  async function getAdvice() {
    if (!situation.trim()) return;
    setAdviceLoading(true); setAdvice(null); setError("");
    try {
      const res = await apiFetch("/api/knowledge/advise", { method: "POST", body: JSON.stringify({ situation }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "生成失败");
      setAdvice(j);
    } catch (e: any) { setError(e.message); } finally { setAdviceLoading(false); }
  }

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(""), 1500);
  }

  async function logout() {
    (await getSupabaseBrowser()).auth.signOut();
    router.replace("/login");
  }

  if (!authChecked) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400 bg-slate-50">加载中…</div>;
  }

  const inputCls = "w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow";

  function statusBadge(s: string) {
    if (s === "generating") return <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20 px-2 py-0.5 text-xs font-medium">生成中</span>;
    if (s === "failed") return <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-500/20 px-2 py-0.5 text-xs font-medium">失败</span>;
    return null;
  }

  return (
    <main className="max-w-xl mx-auto p-4 pb-24">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-base shadow-lg shadow-indigo-500/30">🎯</div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">销售情报官</h1>
            <p className="text-[11px] text-slate-400 -mt-0.5">AI-Powered Sales Copilot</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openSettings} className="w-9 h-9 rounded-full hover:bg-slate-200/60 flex items-center justify-center transition-colors" title="AI 接入设置">⚙️</button>
          <button onClick={logout} className="text-sm text-slate-400 hover:text-slate-600 transition-colors">退出</button>
        </div>
      </header>

      <nav className="grid grid-cols-4 gap-1 mb-5 p-1 bg-slate-200/50 rounded-xl">
        {([["dashboard","作战台"],["analyze","分析"],["history","档案"],["knowledge","军火库"]] as const).map(([k,v]) => (
          <button key={k} onClick={() => { setTab(k as typeof tab); setDetail(null); }}
            className={`py-2 rounded-lg text-sm font-medium transition-all ${tab===k?"bg-white shadow-sm text-indigo-600":"text-slate-500 hover:text-slate-700"}`}>
            {v}
          </button>
        ))}
      </nav>

      {error && <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">{error}</div>}

      {/* 作战台 */}
      {tab === "dashboard" && (
        <div className="space-y-4">
          {dashLoading && !dash ? (
            <div className="animate-pulse space-y-3">{[...Array(3)].map((_,i)=><div key={i} className={`${card} h-28`} />)}</div>
          ) : dash ? (
            <>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label:"客户总数", value:dash.totals.clients },
                  { label:"交互次数", value:dash.totals.interactions },
                  { label:"已成交", value:dash.totals.won },
                  { label:"本周跟进", value:dash.weeklyFollowUps.length },
                ].map(m=>(
                  <div key={m.label} className={`${card} p-3 text-center`}>
                    <div className="text-2xl font-bold text-indigo-600">{m.value}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{m.label}</div>
                  </div>
                ))}
              </div>

              <div className={`${card} p-4`}>
                <h3 className="text-sm font-semibold text-slate-800 mb-3">销售漏斗</h3>
                {dash.funnel.every(f=>f.count===0) ? (
                  <p className="text-xs text-slate-400 py-4 text-center">暂无客户数据 — 去「分析」页添加第一位客户</p>
                ) : (
                  <div className="space-y-2">
                    {(() => {
                      const maxC = Math.max(...dash.funnel.map(f=>f.count), 1);
                      return dash.funnel.map(f=>(
                        <div key={f.stage} className="flex items-center gap-2">
                          <span className="w-14 text-xs text-slate-500 shrink-0">{STAGES[f.stage]}</span>
                          <div className="flex-1 h-6 bg-slate-100 rounded-md overflow-hidden">
                            <div className="h-full rounded-md bg-gradient-to-r from-indigo-400 to-violet-500 flex items-center justify-end pr-2 transition-all duration-500"
                              style={{width:`${Math.max(f.count/maxC*100, f.count>0?12:0)}%`}}>
                              {f.count>0 && <span className="text-xs font-semibold text-white">{f.count}</span>}
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>

                            <div className={`${card} p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-800">⏰ 本周待跟进</h3>
                  {dash.weeklyFollowUps.length>0 && <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">{dash.weeklyFollowUps.length} 条</span>}
                </div>
                {dash.weeklyFollowUps.length===0 ? (
                  <p className="text-xs text-slate-400 py-3 text-center">本周暂无到期跟进，保持节奏 👍</p>
                ) : (
                  <div className="space-y-2">
                    {dash.weeklyFollowUps.map(w=>(
                      <button key={w.id} onClick={()=>openDetail(w.id)} className="w-full flex items-center justify-between p-2.5 rounded-lg border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors text-left">
                        <div className="min-w-0">
                          <span className="font-medium text-sm text-slate-800">{w.name}</span>
                          {w.company && <span className="text-xs text-slate-400 ml-1">{w.company}</span>}
                          <div className="text-xs text-orange-500 mt-0.5">📅 {new Date(w.next_follow_up).toLocaleString("zh-CN",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}</div>
                        </div>
                        <StageBadge stage={w.stage} />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* AI 周报入口 */}
              <button onClick={genWeeklyReport}
                className={`w-full ${card} p-4 flex items-center justify-between group hover:border-indigo-300 transition-colors`}>
                <div className="text-left">
                  <h3 className="text-sm font-semibold text-slate-800">📊 AI 周报复盘</h3>
                  <p className="text-xs text-slate-400 mt-0.5">汇总本周数据，生成复盘与下周行动清单</p>
                </div>
                <span className="text-indigo-400 group-hover:translate-x-1 transition-transform">→</span>
              </button>

              {dash.objectionTop.length>0 && (
                <div className={`${card} p-4`}>
                  <h3 className="text-sm font-semibold text-slate-800 mb-3">🔥 客户高频异议 TOP</h3>
                  <div className="space-y-2">
                    {dash.objectionTop.map((o,i)=>(
                      <div key={i} className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center shrink-0 ${i===0?"bg-red-100 text-red-600":i===1?"bg-orange-100 text-orange-600":"bg-yellow-100 text-yellow-600"}`}>{i+1}</span>
                        <span className="flex-1 text-sm text-slate-700 truncate">{o.objection}</span>
                        <span className="text-xs font-semibold text-slate-400">{o.count}次</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {dash.interactionTrend.some(t=>t.count>0) && (
                <div className={`${card} p-4`}>
                  <h3 className="text-sm font-semibold text-slate-800 mb-3">近 7 日交互趋势</h3>
                  <div className="flex items-end justify-between gap-1 h-24">
                    {dash.interactionTrend.map(t=>(
                      <div key={t.date} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full max-w-8 rounded-t-md bg-gradient-to-t from-indigo-500 to-violet-400 transition-all duration-500"
                          style={{height:`${Math.min(t.count/Math.max(...dash.interactionTrend.map(x=>x.count),1)*70,70)}px`, minHeight:t.count>0?8:2}} />
                        <span className="text-[10px] text-slate-400">{t.date.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-slate-400 py-10">加载失败，请刷新重试</div>
          )}
        </div>
      )}

      {/* 分析 */}
      {tab === "analyze" && (
        <>
          <div className="space-y-2 mb-3">
            <input className={inputCls} placeholder="* 客户姓名" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
            <input className={inputCls} placeholder="职位（如：采购总监）" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} />
            <input className={inputCls} placeholder="公司名称" value={form.company} onChange={e=>setForm({...form,company:e.target.value})} />
            <input className={inputCls} placeholder="行业" value={form.industry} onChange={e=>setForm({...form,industry:e.target.value})} />
            <textarea className={inputCls} rows={2} placeholder="背景备注" value={form.note} onChange={e=>setForm({...form,note:e.target.value})} />
          </div>
          <button onClick={()=>analyze()} disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl py-3.5 font-semibold text-base shadow-lg shadow-indigo-500/25 active:shadow-md disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none mb-4 transition-all hover:brightness-110">
            {loading ? "联网搜集情报中…" : "生成作战简报"}
          </button>
          {(report||loading) && (
            <div className={`${card} p-5 relative`}>
              {loading && !report && <div className="text-slate-400 animate-pulse text-sm">正在联网搜集情报 + 分析…</div>}
              {!loading && report && (
                <button onClick={()=>copyText(report,"report")} className="absolute top-3 right-3 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-2.5 py-1 rounded-lg transition-colors">
                  {copiedId==="report"?"✓ 已复制":"复制"}
                </button>
              )}
              <ReactMarkdown>{report}</ReactMarkdown>
            </div>
          )}
        </>
      )}

      {/* 档案列表 */}
      {tab === "history" && !detail && (
        <div>
          <input className={`${inputCls} mb-3`} placeholder="搜索姓名 / 公司 / 行业 / 备注" value={searchQ} onChange={e=>setSearchQ(e.target.value)} />
          <div className="space-y-2">
            {clients.length===0 && <div className="text-slate-400 text-center py-12">{searchQ?"无匹配结果":"暂无客户档案"}</div>}
            {clients.map(c=>(
              <button key={c.id} onClick={()=>openDetail(c.id)} className={`w-full text-left ${card} p-4 active:bg-slate-50 transition-colors`}>
                <div className="flex justify-between items-center gap-2">
                  <span className="font-semibold text-slate-900 truncate">{c.name}{c.company?<span className="font-normal text-slate-400"> · {c.company}</span>:null}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {statusBadge(c.status)}
                    <StageBadge stage={c.stage} />
                  </div>
                </div>
                {c.next_follow_up && <div className="text-xs text-orange-500 mt-1.5">⏰ 跟进: {new Date(c.next_follow_up).toLocaleString("zh-CN",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}</div>}
                <div className="text-xs text-slate-400 mt-1">{[c.title,c.industry].filter(Boolean).join(" · ")||"—"} · 录入于 {new Date(c.created_at).toLocaleDateString("zh-CN")}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 客户详情 */}
      {tab === "history" && detail && (
        <div>
          <button onClick={()=>setDetail(null)} className="text-indigo-600 text-sm mb-3 hover:underline">← 返回列表</button>

          <div className={`${card} p-5 mb-3`}>
            <div className="flex justify-between items-start">
              <div>
                <div className="font-bold text-lg text-slate-900">{detail.name}</div>
                <div className="text-sm text-slate-500 mt-0.5">{[detail.title,detail.company,detail.industry].filter(Boolean).join(" · ")}</div>
              </div>
              <button onClick={()=>deleteClient(detail.id)} className="text-xs text-red-300 hover:text-red-500 transition-colors">删除</button>
            </div>
            {detail.note && <div className="text-sm mt-3 p-2.5 bg-amber-50/60 border border-amber-100/60 rounded-lg text-slate-700">📌 {detail.note}</div>}
            {detail.status==="failed" && (
              <button onClick={()=>retryFailed(detail)} className="mt-3 w-full text-sm bg-orange-50 text-orange-700 rounded-lg py-2.5 font-medium hover:bg-orange-100 transition-colors">
                简报生成失败，点击重试
              </button>
            )}
            <div className="flex gap-1.5 mt-3 flex-wrap">
              {Object.entries(STAGES).map(([k,v])=>(
                <button key={k} onClick={()=>updateStage(detail.id,k)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                    detail.stage===k ? "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/30" : "border-slate-200 text-slate-500 hover:border-indigo-300"}`}>
                  {v}
                </button>
              ))}
            </div>
            {detail.next_follow_up && (
              <div className="text-xs text-orange-500 mt-3">⏰ 下次跟进: {new Date(detail.next_follow_up).toLocaleString("zh-CN")}</div>
            )}
          </div>

          {detail.profile && typeof detail.profile==="string" && (
            <div className={`${card} p-5 relative`}>
              <button onClick={()=>copyText(detail.profile as string, "detail")} className="absolute top-3 right-3 text-xs bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-lg">
                {copiedId==="detail"?"✓":"复制"}
              </button>
              <ReactMarkdown>{detail.profile}</ReactMarkdown>
            </div>
          )}

          <div className="flex items-center justify-between mt-5 mb-2.5">
            <h3 className="font-bold text-sm text-slate-800">交互记录 ({detail.interactions.length})</h3>
            <button onClick={()=>{setShowParseModal(true);setParsed(null);}}
              className="text-xs bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white px-3 py-2 rounded-lg font-medium shadow-sm hover:brightness-110 transition-all">
              ✨ AI 解析聊天记录
            </button>
          </div>

          <form onSubmit={async e=>{
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            await apiFetch("/api/interactions",{
              method:"POST",
              body:JSON.stringify({
                client_id:detail.id,type:fd.get("type"),
                summary:fd.get("summary")||null,next_step:fd.get("next_step")||null,
                next_step_time:fd.get("next_step_time")||null,
              }),
            });
            (e.target as HTMLFormElement).reset();
            openDetail(detail.id); loadDashboard();
          }} className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/80 space-y-2 mb-3">
            <div className="flex gap-2">
              <select name="type" className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm flex-1 bg-white" defaultValue="call">
                {Object.entries(TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
              <input name="next_step_time" type="datetime-local" className="border border-slate-300 rounded-lg px-2 py-1.5 text-sm flex-1 bg-white" title="下次跟进时间"/>
            </div>
            <textarea name="summary" rows={2} placeholder="沟通摘要" className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"/>
            <input name="next_step" placeholder="下一步动作（可选）" className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm bg-white"/>
            <button type="submit" className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 transition-colors">记录本次交互</button>
          </form>

          <div className="space-y-2">
            {detail.interactions.map(it=>(
              <div key={it.id} className={`${card} p-3.5 text-sm`}>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="font-medium text-indigo-600">{TYPE_LABELS[it.type]||it.type}</span>
                  <span className="text-xs text-slate-400">{new Date(it.created_at).toLocaleString("zh-CN")}</span>
                </div>
                {it.summary && <p className="text-slate-700 whitespace-pre-wrap">{it.summary}</p>}
                {Array.isArray(it.commitments)&&it.commitments.length>0 && (
                  <div className="mt-2"><span className="text-emerald-600 text-xs">🤝 承诺:</span>{(it.commitments as string[]).map((c,i)=><span key={i} className="text-xs bg-emerald-50 text-emerald-700 rounded-md px-1.5 py-0.5 mx-1 inline-block ring-1 ring-emerald-600/10">{c}</span>)}</div>
                )}
                {Array.isArray(it.objections)&&it.objections.length>0 && (
                  <div className="mt-1"><span className="text-red-500 text-xs">⚠️ 异议:</span>{(it.objections as string[]).map((o,i)=><span key={i} className="text-xs bg-red-50 text-red-600 rounded-md px-1.5 py-0.5 mx-1 inline-block ring-1 ring-red-600/10">{o}</span>)}</div>
                )}
                {it.next_step && <p className="mt-1.5 text-orange-500">→ {it.next_step}{it.next_step_time?` (${new Date(it.next_step_time).toLocaleString("zh-CN",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})})`:""}</p>}
                <div className="mt-2 pt-2 border-t border-slate-100 flex justify-end">
                  <button onClick={()=>distillToKnowledge(it.id)} disabled={distillingId===it.id}
                    className="text-xs text-purple-500 hover:text-purple-700 disabled:text-slate-300 transition-colors">
                    {distillingId===it.id?"提炼中…":"✦ 沉淀为共享知识"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 军火库 */}
      {tab === "knowledge" && (
        <div>
          <div className="relative overflow-hidden mb-4 rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-500 p-4 shadow-lg shadow-purple-500/25">
            <div className="absolute inset-0 opacity-40" style={{backgroundImage:"radial-gradient(circle at 1px 1px, rgba(255,255,255,0.25) 1px, transparent 0)", backgroundSize:"16px 16px"}}/>
            <div className="relative">
              <h3 className="font-bold text-white">🔫 话术军火</h3>
              <p className="text-xs text-purple-100 mt-0.5 mb-2.5">输入客户原话，从社区实战知识库调取弹药</p>
              <textarea rows={2} className="w-full border-0 rounded-xl px-3 py-2.5 text-sm bg-white/95 placeholder:text-purple-300 focus:outline-none focus:ring-2 focus:ring-white/50" placeholder='例：客户说"你们比XX品牌贵了20%，我再考虑考虑"'
                value={situation} onChange={e=>setSituation(e.target.value)}/>
              <button onClick={getAdvice} disabled={adviceLoading||!situation.trim()}
                className="mt-2 w-full bg-white text-purple-700 rounded-xl py-2.5 text-sm font-bold shadow disabled:opacity-50 hover:bg-purple-50 transition-colors">
                {adviceLoading?"检索知识库 + 装填弹药…":"获取应对方案"}
              </button>
              {advice && (
                <div className="mt-3 space-y-2 text-sm">
                  {advice.references.length>0 && (
                    <div className="text-xs text-purple-100 bg-white/10 rounded-lg px-2.5 py-1.5">📚 命中知识: {advice.references.map(r=>r.title).join(" / ")}</div>
                  )}
                  <div className="bg-white/95 rounded-xl p-3"><div className="text-xs text-purple-500 mb-1 font-medium">💡 拆解</div><span className="text-slate-700">{advice.analysis}</span></div>
                  <div className="bg-white/95 rounded-xl p-3"><div className="text-xs text-purple-500 mb-1 font-medium">🎯 要点</div><ul className="list-disc pl-4 space-y-0.5 text-slate-700">{advice.talking_points.map((t,i)=><li key={i}>{t}</li>)}</ul></div>
                  <div className="bg-white/95 rounded-xl p-3 relative">
                    <div className="text-xs text-purple-500 mb-1 font-medium">💬 建议回复（可直接发）</div>
                    <span className="text-slate-700">{advice.suggested_reply}</span>
                    <button onClick={()=>copyText(advice.suggested_reply,"reply")} className="absolute top-2 right-2 text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-md">{copiedId==="reply"?"✓":"复制"}</button>
                  </div>
                  <div className="text-xs text-amber-200">→ 跟进建议: {advice.follow_up}</div>
                </div>
              )}
            </div>
          </div>

          <div className={`${card} p-4 mb-3`}>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="font-bold text-sm text-slate-800">{kEditing?"编辑知识条目":"贡献你的实战经验"}</h3>
              {kEditing&&<button onClick={()=>{setKEditing(null);setKForm({title:"",category:"objection",content:""});}} className="text-xs text-slate-400">取消编辑</button>}
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input className={`${inputCls} flex-1`} placeholder="标题（含客户原话关键词更易命中）" value={kForm.title} onChange={e=>setKForm({...kForm,title:e.target.value})}/>
                <select className="border border-slate-300 rounded-lg px-2 text-sm w-28 bg-white" value={kForm.category} onChange={e=>setKForm({...kForm,category:e.target.value})}>
                  {Object.entries(CAT_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <textarea rows={4} className={inputCls} placeholder="正文：策略步骤 + 具体话术 + 禁忌事项…" value={kForm.content} onChange={e=>setKForm({...kForm,content:e.target.value})}/>
              <button onClick={saveDoc} className="w-full bg-slate-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-slate-700 transition-colors">
                {kEditing?"保存修改":"入库共享（自动向量化）"}
              </button>
            </div>
          </div>

          <input className={`${inputCls} mb-2`} placeholder="搜索全社区知识库" value={kQ} onChange={e=>setKQ(e.target.value)}/>
          <div className="space-y-2">
            {docs.length===0 && <div className="text-slate-400 text-center py-8 text-sm">暂无匹配条目</div>}
            {docs.map(d=>(
              <button key={d.id} onClick={()=>viewDocFull(d.id)} className={`w-full text-left ${card} p-3.5 text-sm active:bg-slate-50`}>
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded-md mr-1.5 font-medium ${d.category==="objection"?"bg-red-50 text-red-600":d.category==="case"?"bg-emerald-50 text-emerald-700":"bg-indigo-50 text-indigo-600"}`}>
                      {CAT_LABELS[d.category]||d.category}
                    </span>
                    <span className="font-semibold text-slate-800">{d.title}</span>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-2" onClick={e=>e.stopPropagation()}>
                    <button onClick={()=>editDoc(d)} className="text-xs text-indigo-500 hover:text-indigo-700">改</button>
                    <button onClick={()=>deleteDoc(d.id)} className="text-xs text-red-300 hover:text-red-500">删</button>
                  </div>
                </div>
                <p className="text-slate-500 text-xs mt-1 line-clamp-2">{d.content}</p>
                <div className="text-xs text-indigo-400 mt-1.5">查看全文 →</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 设置弹窗 */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={()=>setShowSettings(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-4" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-slate-900">⚙️ AI 接入设置</h3>
              <button onClick={()=>setShowSettings(false)} className="text-slate-400 text-xl">×</button>
            </div>
            {settingsLoading?(<div className="text-slate-400 text-sm py-6 text-center">加载中…</div>):llmCfg?(<LlmSettingsPanel cfg={llmCfg} onSave={saveLlmConfig}/>):(<div className="text-red-500 text-sm">加载失败，请关闭重试</div>)}
          </div>
        </div>
      )}

      {/* 会话解析弹窗 */}
      {showParseModal && detail && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={()=>setShowParseModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-4" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-slate-900">✨ AI 解析聊天记录</h3>
              <button onClick={()=>setShowParseModal(false)} className="text-slate-400 text-xl">×</button>
            </div>
            <p className="text-xs text-slate-400 mb-2">粘贴微信/QQ聊天原文（长按消息→多选→合并转发→复制）</p>
            {!parsed?(
              <>
                <textarea rows={8} className={`${inputCls} mb-2`} placeholder={"例：\n我：王总，报价单您看了吗\n客户：看了，价格还是偏高，我们预算有限"}
                  value={chatText} onChange={e=>setChatText(e.target.value)}/>
                <button onClick={parseChat} disabled={parsing||!chatText.trim()}
                  className="w-full bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white rounded-lg py-2.5 font-medium disabled:bg-slate-300 shadow-sm">
                  {parsing?"解析中…":"开始解析"}
                </button>
              </>
            ):(
              <div className="space-y-2 text-sm">
                <div className="bg-slate-50 rounded-lg p-3"><div className="text-xs text-slate-400 mb-1">📋 摘要</div>{parsed.summary}</div>
                {parsed.commitments.length>0 && <div className="bg-emerald-50 rounded-lg p-3"><div className="text-xs text-emerald-600 mb-1">🤝 客户承诺</div><ul className="list-disc pl-4">{parsed.commitments.map((c,i)=><li key={i}>{c}</li>)}</ul></div>}
                {parsed.objections.length>0 && <div className="bg-red-50 rounded-lg p-3"><div className="text-xs text-red-500 mb-1">⚠️ 异议</div><ul className="list-disc pl-4">{parsed.objections.map((o,i)=><li key={i}>{o}</li>)}</ul></div>}
                {parsed.next_step && <div className="bg-orange-50 rounded-lg p-3"><div className="text-xs text-orange-500 mb-1">→ 下一步</div>{parsed.next_step}{parsed.next_step_time&&<div className="text-xs mt-1">时间: {new Date(parsed.next_step_time).toLocaleString("zh-CN")}</div>}</div>}
                {parsed.reply_suggestion && (
                  <div className="bg-purple-50 rounded-lg p-3 relative">
                    <div className="text-xs text-purple-500 mb-1">💬 建议回复</div>
                    <span className="text-slate-700">{parsed.reply_suggestion}</span>
                    <button onClick={()=>copyText(parsed.reply_suggestion,"reply")} className="absolute top-2 right-2 text-xs bg-white px-1.5 py-0.5 rounded-md shadow">{copiedId==="reply"?"✓":"复制"}</button>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <button onClick={()=>{setParsed(null)}} className="flex-1 border border-slate-200 rounded-lg py-2.5 text-sm text-slate-600">重新解析</button>
                  <button onClick={saveParsedToInteraction} className="flex-1 bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-700">入库到「{detail.name}」</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 知识全文弹窗 */}
      {viewDoc && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={()=>setViewDoc(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-4" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className={`text-xs px-1.5 py-0.5 rounded-md mr-1.5 font-medium ${viewDoc.category==="objection"?"bg-red-50 text-red-600":viewDoc.category==="case"?"bg-emerald-50 text-emerald-700":"bg-indigo-50 text-indigo-600"}`}>
                  {CAT_LABELS[viewDoc.category]||viewDoc.category}
                </span>
                <h3 className="font-bold inline text-slate-900">{viewDoc.title}</h3>
              </div>
              <button onClick={()=>setViewDoc(null)} className="text-slate-400 text-xl leading-none">×</button>
            </div>
            <div className="whitespace-pre-wrap border border-slate-100 rounded-xl p-3.5 bg-slate-50/80 text-sm text-slate-700 mt-2">{viewDoc.content}</div>
            <div className="text-xs text-slate-400 mt-2">{new Date(viewDoc.created_at).toLocaleString("zh-CN")} · 全社区共享知识</div>
          </div>
        </div>
      )}

      {/* AI 周报弹窗 */}
      {showWeekly && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={()=>setShowWeekly(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-4" onClick={e=>e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-slate-900">📊 AI 周报复盘</h3>
              <button onClick={()=>setShowWeekly(false)} className="text-slate-400 text-xl">×</button>
            </div>
            {weeklyLoading ? (
              <div className="py-10 text-center space-y-3">
                <div className="animate-pulse text-indigo-500 text-sm">AI 正在分析本周数据…</div>
                <div className="flex justify-center gap-1.5">
                  {[...Array(3)].map((_,i)=><span key={i} className="w-2 h-2 rounded-full bg-indigo-300 animate-bounce" style={{animationDelay:`${i*0.15}s`}}/>)}
                </div>
              </div>
            ) : (
              <>
                <div className="prose-sm border border-slate-100 rounded-xl p-4 bg-slate-50/80"><ReactMarkdown>{weeklyReport}</ReactMarkdown></div>
                <button onClick={()=>copyText(weeklyReport,"weekly")} className="mt-3 w-full bg-slate-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-slate-700 transition-colors">
                  {copiedId==="weekly"?"✓ 已复制到剪贴板":"复制周报全文"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

const KNOWN_PROVIDERS: Record<string,{label:string;baseURL:string;defaultModel:string}> = {
  deepseek:{label:"DeepSeek",baseURL:"https://api.deepseek.com/v1",defaultModel:"deepseek-chat"},
  zhipu:{label:"智谱 GLM",baseURL:"https://open.bigmodel.cn/api/paas/v4",defaultModel:"glm-4-flash"},
  qwen:{label:"通义千问",baseURL:"https://dashscope.aliyuncs.com/compatible-mode/v1",defaultModel:"qwen-plus"},
  agnes:{label:"Agnes AI",baseURL:"https://apihub.agnes-ai.com/v1",defaultModel:"agnes-2.5-flash"},
  openai:{label:"OpenAI",baseURL:"https://api.openai.com/v1",defaultModel:"gpt-4o-mini"},
};

function LlmSettingsPanel({cfg,onSave}:{cfg:{provider:string;model:string;hasKey:boolean};onSave:(p:string,k:string,m?:string)=>Promise<void>}) {
  const isCustom=!KNOWN_PROVIDERS[cfg.provider];
  const [mode,setMode]=useState<"preset"|"custom">(isCustom?"custom":"preset");
  const [provider,setProvider]=useState(cfg.provider);
  const [apiKey,setApiKey]=useState("");
  const [model,setModel]=useState("");
  const [customBaseURL,setCustomBaseURL]=useState("");
  const [customName,setCustomName]=useState("");
  const [saving,setSaving]=useState(false);
  const [msg,setMsg]=useState("");

  async function handleSave(){
    setSaving(true);setMsg("");
    try{
      if(mode==="preset"){await onSave(provider,apiKey);}
      else{
        if(!customBaseURL.trim()||!customName.trim())throw new Error("自定义接口需填写名称和 API 地址");
        await onSave(`custom:${customName.trim()}|${customBaseURL.trim()}`,apiKey,model.trim()||undefined);
      }
      setMsg("✓ 已生效，立即启用新模型");setApiKey("");
    }catch(e:any){setMsg(e.message);}finally{setSaving(false);}
  }

  const inputCls="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white";

  return (
    <div className="space-y-3">
      <div className="bg-indigo-50 rounded-lg p-3 text-xs text-indigo-900">
        当前：<b>{isCustom?`${cfg.provider.split("|")[0]}（自定义）`:KNOWN_PROVIDERS[cfg.provider]?.label||cfg.provider}</b> · 模型 <b>{cfg.model||"(默认)"}</b> · Key {cfg.hasKey?"已配置 ✓":"未配置 ✗"}
      </div>
      <div className="flex bg-slate-100 rounded-lg p-0.5">
        <button onClick={()=>setMode("preset")} className={`flex-1 py-1.5 rounded-md text-xs ${mode==="preset"?"bg-white shadow font-medium":"text-slate-500"}`}>常用服务商</button>
        <button onClick={()=>setMode("custom")} className={`flex-1 py-1.5 rounded-md text-xs ${mode==="custom"?"bg-white shadow font-medium":"text-slate-500"}`}>自定义接口</button>
      </div>
      {mode==="preset"?(
        <>
          <select className={inputCls} value={provider} onChange={e=>setProvider(e.target.value)}>
            {Object.entries(KNOWN_PROVIDERS).map(([k,v])=><option key={k} value={k}>{v.label}（默认: {v.defaultModel}）</option>)}
          </select>
          <input type="password" className={inputCls} placeholder="新 API Key（留空沿用现有）" value={apiKey} onChange={e=>setApiKey(e.target.value)}/>
        </>
      ):(
        <>
          <input className={inputCls} placeholder="接口名称" value={customName} onChange={e=>setCustomName(e.target.value)}/>
          <input className={inputCls} placeholder="API Base URL（https://xxx.com/v1）" value={customBaseURL} onChange={e=>setCustomBaseURL(e.target.value)}/>
          <input className={inputCls} placeholder="模型名（可选）" value={model} onChange={e=>setModel(e.target.value)}/>
          <input type="password" className={inputCls} placeholder="API Key" value={apiKey} onChange={e=>setApiKey(e.target.value)}/>
          <p className="text-xs text-slate-400">兼容 OpenAI Chat Completions 协议的任意服务</p>
        </>
      )}
      <button onClick={handleSave} disabled={saving} className="w-full bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:bg-slate-300 transition-colors">
        {saving?"保存中…":"保存并立即生效"}
      </button>
      {msg&&<div className={`text-xs ${msg.startsWith("✓")?"text-emerald-600":"text-red-500"}`}>{msg}</div>}
    </div>
  );
}