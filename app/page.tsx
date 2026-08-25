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
const CAT_LABELS: Record<string, string> = {
  objection: "异议应对", faq: "产品FAQ", competitor: "竞品对比",
  case: "成功案例", script: "标准话术", other: "其他",
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

export default function Home() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState<"analyze" | "history" | "knowledge">("analyze");

  // ===== 分析 tab 状态 =====
  const [form, setForm] = useState({ name: "", title: "", company: "", industry: "", note: "" });
  const [report, setReport] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // ===== 历史 tab 状态 =====
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [detail, setDetail] = useState<(Client & { interactions: Interaction[] }) | null>(null);
  const [copied, setCopied] = useState(false);

  // ===== 会话情报员状态 =====
  const [showParseModal, setShowParseModal] = useState(false);
  const [chatText, setChatText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedInteraction | null>(null);

  // ===== 知识库 tab 状态 =====
  const [docs, setDocs] = useState<any[]>([]);
  const [kQ, setKQ] = useState("");
  const [kForm, setKForm] = useState({ title: "", category: "objection", content: "" });
  const [kEditing, setKEditing] = useState<any>(null);
  const [viewDoc, setViewDoc] = useState<any>(null); // 查看全文弹窗

  // ===== AI 接入设置状态 =====
  const [showSettings, setShowSettings] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [llmCfg, setLlmCfg] = useState<{ provider: string; model: string; hasKey: boolean } | null>(null);

  // ===== 话术军火状态 =====
  const [situation, setSituation] = useState("");
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [advice, setAdvice] = useState<Advice | null>(null);

  // 鉴权守卫
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

  useEffect(() => { if (authChecked) loadHistory(); }, [authChecked, loadHistory]);
  useEffect(() => { if (authChecked && tab === "history") loadHistory(searchQ); }, [searchQ, authChecked, tab, loadHistory]);
  useEffect(() => { if (authChecked && tab === "knowledge") loadKnowledge(kQ); }, [kQ, authChecked, tab, loadKnowledge]);

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
      loadHistory();
    } catch (e: any) {
      if (e.name !== "AbortError") setError(e.message || "分析失败");
    } finally {
      setLoading(false);
    }
  }

  // ===== 会话情报员：AI 解析聊天记录 =====
  async function parseChat() {
    if (!chatText.trim()) return;
    setParsing(true); setParsed(null);
    try {
      const res = await apiFetch("/api/interactions/parse", {
        method: "POST",
        body: JSON.stringify({ text: chatText }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "解析失败");
      setParsed(j);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setParsing(false);
    }
  }

  // 解析结果一键入库
  async function saveParsedToInteraction() {
    if (!parsed || !detail) return;
    await apiFetch("/api/interactions", {
      method: "POST",
      body: JSON.stringify({
        client_id: detail.id,
        type: "wechat",
        summary: parsed.summary,
        commitments: parsed.commitments,
        objections: parsed.objections,
        next_step: parsed.next_step,
        next_step_time: parsed.next_step_time,
        raw_content: parsed.raw_content,
      }),
    });
    setShowParseModal(false);
    setChatText(""); setParsed(null);
    openDetail(detail.id);
  }

  async function openDetail(id: string) {
    const res = await apiFetch(`/api/clients/${id}`);
    if (res.ok) { setDetail(await res.json()); setTab("history"); }
  }

  async function updateStage(id: string, stage: string) {
    await apiFetch(`/api/clients/${id}`, { method: "PATCH", body: JSON.stringify({ stage }) });
    if (detail && detail.id === id) setDetail({ ...detail, stage: stage as Client["stage"] });
    loadHistory();
  }

  async function deleteClient(id: string) {
    if (!confirm("确定删除该客户及其全部交互记录？不可恢复。")) return;
    await apiFetch(`/api/clients/${id}`, { method: "DELETE" });
    setDetail(null);
    loadHistory();
  }

  async function retryFailed(c: Client) {
    setTab("analyze");
    analyze(c.id, { name: c.name, title: c.title || "", company: c.company || "", industry: c.industry || "", note: c.note || "" });
  }

  // ===== 知识库操作 =====
  async function saveDoc() {
    if (!kForm.title.trim() || !kForm.content.trim()) return;
    if (kEditing) {
      await apiFetch(`/api/knowledge/${kEditing.id}`, {
        method: "PATCH",
        body: JSON.stringify(kForm),
      });
    } else {
      const res = await apiFetch("/api/knowledge", { method: "POST", body: JSON.stringify(kForm) });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "保存失败");
        return;
      }
    }
    setKForm({ title: "", category: "objection", content: "" });
    setKEditing(null);
    loadKnowledge();
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

  // 查看知识全文
  async function viewDocFull(id: string) {
    const res = await apiFetch(`/api/knowledge/${id}/view`);
    if (res.ok) setViewDoc(await res.json());
  }

  // ===== AI 接入设置 =====
  async function openSettings() {
    setShowSettings(true);
    setSettingsLoading(true);
    try {
      const res = await apiFetch("/api/llm-config");
      const j = await res.json();
      if (res.ok) setLlmCfg(j);
    } catch {} finally {
      setSettingsLoading(false);
    }
  }

  async function saveLlmConfig(provider: string, apiKey: string, model?: string) {
    const res = await apiFetch("/api/llm-config", {
      method: "POST",
      body: JSON.stringify({ provider, apiKey, model }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || "保存失败");
    // 重新拉取当前配置
    const cfgRes = await apiFetch("/api/llm-config");
    if (cfgRes.ok) setLlmCfg(await cfgRes.json());
  }

  // ===== 话术军火 =====
  async function getAdvice() {
    if (!situation.trim()) return;
    setAdviceLoading(true); setAdvice(null); setError("");
    try {
      const res = await apiFetch("/api/knowledge/advise", {
        method: "POST",
        body: JSON.stringify({ situation }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "生成失败");
      setAdvice(j);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAdviceLoading(false);
    }
  }

  function copyText(text: string) {
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
      <header className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold">🎯 销售情报官</h1>
        <div className="flex items-center gap-3">
          <button onClick={openSettings} className="text-sm text-gray-400 hover:text-gray-600" title="AI 接入设置">⚙️</button>
          <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-600">退出</button>
        </div>
      </header>

      {/* 三标签导航 */}
      <div className="flex bg-gray-100 rounded-lg p-0.5 mb-4">
        {([["analyze", "分析"], ["history", `历史${clients.length ? `(${clients.length})` : ""}`], ["knowledge", "知识库"]] as const).map(([k, v]) => (
          <button key={k} onClick={() => { setTab(k as typeof tab); setDetail(null); }}
            className={`flex-1 py-1.5 rounded-md text-sm ${tab === k ? "bg-white shadow font-medium" : "text-gray-500"}`}>
            {v}
          </button>
        ))}
      </div>

      {error && (
        <div className="text-red-600 text-sm mb-3 bg-red-50 rounded-lg p-2">{error}</div>
      )}

      {/* ============ 分析 TAB ============ */}
      {tab === "analyze" && (
        <>
          <div className="space-y-2 mb-3">
            <input className={inputCls} placeholder="* 客户姓名" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input className={inputCls} placeholder="职位（如：采购总监）" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            <input className={inputCls} placeholder="公司名称" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} />
            <input className={inputCls} placeholder="行业" value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} />
            <textarea className={inputCls} rows={2} placeholder="背景备注" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
          </div>
          <button onClick={() => analyze()} disabled={loading}
            className="w-full bg-blue-600 text-white rounded-xl py-3.5 font-medium text-base active:bg-blue-700 disabled:bg-gray-400 mb-4">
            {loading ? "联网搜集情报中…" : "生成作战简报"}
          </button>
          {(report || loading) && (
            <div className="prose-sm border rounded-xl p-4 bg-white shadow-sm relative">
              {loading && !report && <div className="text-gray-400 animate-pulse">正在联网搜集情报 + 分析…</div>}
              {!loading && report && (
                <button onClick={() => copyText(report)} className="absolute top-3 right-3 text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded">
                  {copied ? "✓ 已复制" : "复制"}
                </button>
              )}
              <ReactMarkdown>{report}</ReactMarkdown>
            </div>
          )}
        </>
      )}

      {/* ============ 历史 TAB ============ */}
      {tab === "history" && !detail && (
        <div>
          <input className={`${inputCls} mb-3`} placeholder="搜索客户" value={searchQ} onChange={e => setSearchQ(e.target.value)} />
          <div className="space-y-2">
            {clients.length === 0 && <div className="text-gray-400 text-center py-10">{searchQ ? "无匹配" : "暂无记录"}</div>}
            {clients.map(c => (
              <button key={c.id} onClick={() => openDetail(c.id)} className="w-full text-left border rounded-xl p-3.5 bg-white shadow-sm active:bg-gray-50">
                <div className="flex justify-between items-center gap-2">
                  <span className="font-medium truncate">{c.name}{c.company ? ` · ${c.company}` : ""}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {statusBadge(c.status)}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.stage === "won" ? "bg-green-100 text-green-700" : c.stage === "lost" ? "bg-red-100 text-red-700" : c.stage === "negotiation" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                      {STAGES[c.stage] || c.stage}
                    </span>
                  </div>
                </div>
                {c.next_follow_up && <div className="text-xs text-orange-600 mt-1">⏰ {new Date(c.next_follow_up).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>}
                <div className="text-xs text-gray-400 mt-1">{[c.title, c.industry].filter(Boolean).join(" · ") || "—"} · {new Date(c.created_at).toLocaleDateString("zh-CN")}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 客户详情 */}
      {tab === "history" && detail && (
        <div>
          <button onClick={() => setDetail(null)} className="text-blue-600 text-sm mb-3">← 返回</button>

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
                简报失败，点击重试
              </button>
            )}
            <div className="flex gap-1.5 mt-3 flex-wrap">
              {Object.entries(STAGES).map(([k, v]) => (
                <button key={k} onClick={() => updateStage(detail.id, k)}
                  className={`text-xs px-2.5 py-1 rounded-full border ${detail.stage === k ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600"}`}>
                  {v}
                </button>
              ))}
            </div>
            {detail.next_follow_up && (
              <div className="text-xs text-orange-600 mt-2">⏰ 下次跟进: {new Date(detail.next_follow_up).toLocaleString("zh-CN")}</div>
            )}
          </div>

          {detail.profile && typeof detail.profile === "string" && (
            <div className="prose-sm border rounded-xl p-4 bg-white shadow-sm mb-3 relative">
              <button onClick={() => copyText(detail.profile as string)} className="absolute top-3 right-3 text-xs bg-gray-100 px-2 py-1 rounded">
                {copied ? "✓" : "复制"}
              </button>
              <ReactMarkdown>{detail.profile}</ReactMarkdown>
            </div>
          )}

          {/* 交互记录区 */}
          <div className="flex items-center justify-between mt-4 mb-2">
            <h3 className="font-bold text-sm">交互记录 ({detail.interactions.length})</h3>
            <button onClick={() => { setShowParseModal(true); setParsed(null); }}
              className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg font-medium active:bg-purple-700">
              ✨ AI 解析聊天记录
            </button>
          </div>

          <form onSubmit={async (e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            await apiFetch("/api/interactions", {
              method: "POST",
              body: JSON.stringify({
                client_id: detail.id, type: fd.get("type"),
                summary: fd.get("summary") || null, next_step: fd.get("next_step") || null,
                next_step_time: fd.get("next_step_time") || null,
              }),
            });
            (e.target as HTMLFormElement).reset();
            openDetail(detail.id);
          }} className="border rounded-xl p-3 bg-gray-50 space-y-2 mb-3">
            <div className="flex gap-2">
              <select name="type" className="border rounded-lg px-2 py-1.5 text-sm flex-1" defaultValue="call">
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input name="next_step_time" type="datetime-local" className="border rounded-lg px-2 py-1.5 text-sm flex-1" title="下次跟进时间" />
            </div>
            <textarea name="summary" rows={2} placeholder="沟通摘要" className="w-full border rounded-lg px-2 py-1.5 text-sm" />
            <input name="next_step" placeholder="下一步动作（可选）" className="w-full border rounded-lg px-2 py-1.5 text-sm" />
            <button type="submit" className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium active:bg-blue-700">记录交互</button>
          </form>

          <div className="space-y-2">
            {detail.interactions.map(it => (
              <div key={it.id} className="border rounded-xl p-3 bg-white text-sm">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium text-blue-700">{TYPE_LABELS[it.type] || it.type}</span>
                  <span className="text-xs text-gray-400">{new Date(it.created_at).toLocaleString("zh-CN")}</span>
                </div>
                {it.summary && <p className="text-gray-700 whitespace-pre-wrap">{it.summary}</p>}
                {Array.isArray(it.commitments) && it.commitments.length > 0 && (
                  <div className="mt-1.5"><span className="text-green-700 text-xs">🤝 客户承诺:</span>{(it.commitments as string[]).map((c, i) => <span key={i} className="text-xs bg-green-50 text-green-800 rounded px-1.5 py-0.5 mx-1 inline-block">{c}</span>)}</div>
                )}
                {Array.isArray(it.objections) && it.objections.length > 0 && (
                  <div className="mt-1"><span className="text-red-600 text-xs">⚠️ 异议:</span>{(it.objections as string[]).map((o, i) => <span key={i} className="text-xs bg-red-50 text-red-700 rounded px-1.5 py-0.5 mx-1 inline-block">{o}</span>)}</div>
                )}
                {it.next_step && <p className="mt-1 text-orange-600">→ {it.next_step}{it.next_step_time ? ` (${new Date(it.next_step_time).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })})` : ""}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============ 知识库 TAB ============ */}
      {tab === "knowledge" && (
        <div>
          {/* 话术军火 - 置顶入口 */}
          <div className="border-2 border-purple-200 rounded-xl p-4 bg-purple-50 mb-4">
            <h3 className="font-bold text-sm mb-1">🔫 话术军火</h3>
            <p className="text-xs text-gray-500 mb-2">输入客户的原话或情境，检索你的知识库并生成定制应对话术</p>
            <textarea rows={2} className={`${inputCls} mb-2`} placeholder='例：客户说"你们比XX品牌贵了20%，我再考虑考虑"'
              value={situation} onChange={e => setSituation(e.target.value)} />
            <button onClick={getAdvice} disabled={adviceLoading}
              className="w-full bg-purple-600 text-white rounded-lg py-2.5 text-sm font-medium active:bg-purple-700 disabled:bg-gray-400">
              {adviceLoading ? "检索知识库 + 生成话术…" : "获取应对方案"}
            </button>

            {advice && (
              <div className="mt-3 space-y-2 text-sm">
                {advice.references.length > 0 && (
                  <div className="text-xs text-purple-700">📚 命中知识: {advice.references.map(r => r.title).join(" / ")}</div>
                )}
                <div className="bg-white rounded-lg p-3 border">
                  <div className="text-xs text-gray-400 mb-1">💡 拆解</div>
                  {advice.analysis}
                </div>
                <div className="bg-white rounded-lg p-3 border">
                  <div className="text-xs text-gray-400 mb-1">🎯 要点</div>
                  <ul className="list-disc pl-4 space-y-0.5">{advice.talking_points.map((t, i) => <li key={i}>{t}</li>)}</ul>
                </div>
                <div className="bg-white rounded-lg p-3 border relative">
                  <div className="text-xs text-gray-400 mb-1">💬 建议回复（可直接发）</div>
                  {advice.suggested_reply}
                  <button onClick={() => navigator.clipboard.writeText(advice.suggested_reply)} className="absolute top-2 right-2 text-xs bg-gray-100 px-1.5 py-0.5 rounded">复制</button>
                </div>
                <div className="text-xs text-orange-600">→ 跟进建议: {advice.follow_up}</div>
              </div>
            )}
          </div>

          {/* 知识条目表单 */}
          <div className="border rounded-xl p-4 bg-white shadow-sm mb-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-sm">{kEditing ? "编辑知识条目" : "添加知识条目"}</h3>
              {kEditing && <button onClick={() => { setKEditing(null); setKForm({ title: "", category: "objection", content: "" }); }} className="text-xs text-gray-400">取消</button>}
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input className={`${inputCls} flex-1`} placeholder="标题（如：价格异议应对）" value={kForm.title} onChange={e => setKForm({ ...kForm, title: e.target.value })} />
                <select className="border rounded-lg px-2 text-sm w-28" value={kForm.category} onChange={e => setKForm({ ...kForm, category: e.target.value })}>
                  {Object.entries(CAT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <textarea rows={4} className={inputCls} placeholder="正文：话术内容、案例、竞品对比…" value={kForm.content} onChange={e => setKForm({ ...kForm, content: e.target.value })} />
              <button onClick={saveDoc} className="w-full bg-gray-800 text-white rounded-lg py-2 text-sm font-medium active:bg-black">
                {kEditing ? "保存修改" : "入库（自动向量化）"}
              </button>
            </div>
          </div>

          {/* 知识列表 */}
          <input className={`${inputCls} mb-2`} placeholder="搜索知识库" value={kQ} onChange={e => setKQ(e.target.value)} />
          <div className="space-y-2">
            {docs.length === 0 && <div className="text-gray-400 text-center py-6 text-sm">暂无条目 — 把你的成交话术、踩坑经验存进来，AI 应对时就会用你的打法</div>}
            {docs.map(d => (
              <button key={d.id} onClick={() => viewDocFull(d.id)} className="w-full text-left border rounded-xl p-3 bg-white text-sm active:bg-gray-50">
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded mr-1.5 ${d.category === "objection" ? "bg-red-50 text-red-600" : d.category === "case" ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"}`}>
                      {CAT_LABELS[d.category] || d.category}
                    </span>
                    <span className="font-medium">{d.title}</span>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => editDoc(d)} className="text-xs text-blue-500">改</button>
                    <button onClick={() => deleteDoc(d.id)} className="text-xs text-red-400">删</button>
                  </div>
                </div>
                <p className="text-gray-500 text-xs mt-1 line-clamp-2">{d.content}</p>
                <div className="text-xs text-blue-400 mt-1">点击查看全文 →</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ============ AI 解析弹窗 ============ */}
      {showParseModal && detail && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowParseModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold">✨ AI 解析聊天记录</h3>
              <button onClick={() => setShowParseModal(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <p className="text-xs text-gray-400 mb-2">粘贴微信/QQ 聊天原文（长按消息→多选→合并转发→复制），AI 自动提取承诺、异议、下一步</p>
            {!parsed ? (
              <>
                <textarea rows={8} className={`${inputCls} mb-2`} placeholder={"例：\n我：王总，报价单您看了吗\n客户：看了，价格还是偏高，我们预算有限\n我：您看这样行不行..."}
                  value={chatText} onChange={e => setChatText(e.target.value)} />
                <button onClick={parseChat} disabled={parsing || !chatText.trim()}
                  className="w-full bg-purple-600 text-white rounded-lg py-2.5 font-medium disabled:bg-gray-400">
                  {parsing ? "解析中…" : "开始解析"}
                </button>
              </>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="bg-gray-50 rounded-lg p-3"><div className="text-xs text-gray-400 mb-1">📋 摘要</div>{parsed.summary}</div>
                {parsed.commitments.length > 0 && <div className="bg-green-50 rounded-lg p-3"><div className="text-xs text-green-600 mb-1">🤝 客户承诺</div><ul className="list-disc pl-4">{parsed.commitments.map((c, i) => <li key={i}>{c}</li>)}</ul></div>}
                {parsed.objections.length > 0 && <div className="bg-red-50 rounded-lg p-3"><div className="text-xs text-red-500 mb-1">⚠️ 异议</div><ul className="list-disc pl-4">{parsed.objections.map((o, i) => <li key={i}>{o}</li>)}</ul></div>}
                {parsed.next_step && <div className="bg-orange-50 rounded-lg p-3"><div className="text-xs text-orange-500 mb-1">→ 下一步</div>{parsed.next_step}{parsed.next_step_time && <div className="text-xs mt-1">时间: {new Date(parsed.next_step_time).toLocaleString("zh-CN")}</div>}</div>}
                {parsed.reply_suggestion && (
                  <div className="bg-purple-50 rounded-lg p-3 relative">
                    <div className="text-xs text-purple-500 mb-1">💬 建议回复</div>
                    {parsed.reply_suggestion}
                    <button onClick={() => navigator.clipboard.writeText(parsed.reply_suggestion)} className="absolute top-2 right-2 text-xs bg-white px-1.5 py-0.5 rounded shadow">复制</button>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <button onClick={() => { setParsed(null); }} className="flex-1 border rounded-lg py-2.5 text-sm">重新解析</button>
                  <button onClick={saveParsedToInteraction} className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium">确认入库到「{detail.name}」</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
{/* ============ AI 接入设置弹窗 ============ */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setShowSettings(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold">⚙️ AI 接入设置</h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 text-xl">×</button>
            </div>
            {settingsLoading ? (
              <div className="text-gray-400 text-sm py-6 text-center">加载中…</div>
            ) : llmCfg ? (
              <LlmSettingsPanel cfg={llmCfg} onSave={saveLlmConfig} />
            ) : (
              <div className="text-red-500 text-sm">加载失败，请关闭重试</div>
            )}
          </div>
        </div>
      )}

      {/* ============ 知识全文查看弹窗 ============ */}
      {viewDoc && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setViewDoc(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className={`text-xs px-1.5 py-0.5 rounded mr-1.5 ${viewDoc.category === "objection" ? "bg-red-50 text-red-600" : viewDoc.category === "case" ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"}`}>
                  {CAT_LABELS[viewDoc.category] || viewDoc.category}
                </span>
                <h3 className="font-bold inline">{viewDoc.title}</h3>
              </div>
              <button onClick={() => setViewDoc(null)} className="text-gray-400 text-xl leading-none">×</button>
            </div>
            <div className="prose-sm whitespace-pre-wrap border rounded-xl p-3 bg-gray-50 mt-2">{viewDoc.content}</div>
            <div className="text-xs text-gray-400 mt-2">
              {new Date(viewDoc.created_at).toLocaleString("zh-CN")} · 全社区共享知识
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ===== AI 设置面板子组件 =====
const KNOWN_PROVIDERS: Record<string, { label: string; baseURL: string; defaultModel: string }> = {
  deepseek: { label: "DeepSeek", baseURL: "https://api.deepseek.com/v1", defaultModel: "deepseek-chat" },
  zhipu:    { label: "智谱 GLM", baseURL: "https://open.bigmodel.cn/api/paas/v4", defaultModel: "glm-4-flash" },
  qwen:     { label: "通义千问", baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", defaultModel: "qwen-plus" },
  agnes:    { label: "Agnes AI", baseURL: "https://apihub.agnes-ai.com/v1", defaultModel: "agnes-2.5-flash" },
  openai:   { label: "OpenAI", baseURL: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini" },
};

function LlmSettingsPanel({ cfg, onSave }: {
  cfg: { provider: string; model: string; hasKey: boolean };
  onSave: (provider: string, apiKey: string, model?: string) => Promise<void>;
}) {
  const isCustom = !KNOWN_PROVIDERS[cfg.provider];
  const [mode, setMode] = useState<"preset" | "custom">(isCustom ? "custom" : "preset");
  const [provider, setProvider] = useState(cfg.provider);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [customBaseURL, setCustomBaseURL] = useState("");
  const [customName, setCustomName] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleSave() {
    setSaving(true); setMsg("");
    try {
      if (mode === "preset") {
        await onSave(provider, apiKey);
      } else {
        if (!customBaseURL.trim() || !customName.trim()) throw new Error("自定义接口需填写名称和 API 地址");
        await onSave(`custom:${customName.trim()}|${customBaseURL.trim()}`, apiKey, model.trim() || undefined);
      }
      setMsg("✓ 已生效，立即启用新模型");
      setApiKey("");
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="space-y-3">
      <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-800">
        当前使用：<b>{isCustom ? `${cfg.provider.split("|")[0]}（自定义）` : KNOWN_PROVIDERS[cfg.provider]?.label || cfg.provider}</b>
        {" · "}模型：<b>{cfg.model}</b>{" · "}Key：{cfg.hasKey ? "已配置 ✓" : "未配置 ✗"}
      </div>

      <div className="flex bg-gray-100 rounded-lg p-0.5">
        <button onClick={() => setMode("preset")} className={`flex-1 py-1.5 rounded-md text-xs ${mode === "preset" ? "bg-white shadow font-medium" : "text-gray-500"}`}>常用服务商</button>
        <button onClick={() => setMode("custom")} className={`flex-1 py-1.5 rounded-md text-xs ${mode === "custom" ? "bg-white shadow font-medium" : "text-gray-500"}`}>自定义接口</button>
      </div>

      {mode === "preset" && (
        <>
          <select className={inputCls} value={provider} onChange={e => setProvider(e.target.value)}>
            {Object.entries(KNOWN_PROVIDERS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}（默认模型: {v.defaultModel}）</option>
            ))}
          </select>
          <input type="password" className={inputCls} placeholder="输入新的 API Key（留空则沿用现有）" value={apiKey} onChange={e => setApiKey(e.target.value)} />
        </>
      )}

      {mode === "custom" && (
        <>
          <input className={inputCls} placeholder="接口名称（如：我的中转站）" value={customName} onChange={e => setCustomName(e.target.value)} />
          <input className={inputCls} placeholder="API Base URL（如 https://xxx.com/v1）" value={customBaseURL} onChange={e => setCustomBaseURL(e.target.value)} />
          <input className={inputCls} placeholder="模型名（如 gpt-4o-mini，可选）" value={model} onChange={e => setModel(e.target.value)} />
          <input type="password" className={inputCls} placeholder="API Key" value={apiKey} onChange={e => setApiKey(e.target.value)} />
          <p className="text-xs text-gray-400">兼容 OpenAI Chat Completions 协议的任何服务均可接入</p>
        </>
      )}

      <button onClick={handleSave} disabled={saving}
        className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium active:bg-blue-700 disabled:bg-gray-400">
        {saving ? "保存中…" : "保存并立即生效"}
      </button>
      {msg && <div className={`text-xs ${msg.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>{msg}</div>}
    </div>
  );
}