// 全局 fetch 封装 - 自动带 token、401 自动跳登录
import { getSupabaseBrowser } from "./supabase-browser";

export async function apiFetch(url: string, options: RequestInit = {}) {
  const supabase = await getSupabaseBrowser();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
  });

  // 401 = 登录过期，踢回登录页
  if (res.status === 401) {
    await supabase.auth.signOut();
    window.location.href = "/login";
    throw new Error("登录已过期");
  }

  return res;
}

// ===== 浏览器跟进提醒轮询（方向一收尾：主动通知闭环）=====
let notifyTimerStarted = false;
const notifiedIds = new Set<string>();

export function startFollowUpNotifier(onDue: (items: { id: string; name: string; company: string | null; next_follow_up: string }[]) => void) {
  if (notifyTimerStarted || typeof window === "undefined") return;
  notifyTimerStarted = true;

  async function poll() {
    try {
      const res = await apiFetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      const due = (data.due || []) as any[];
      const fresh = due.filter((c) => !notifiedIds.has(c.id));
      if (fresh.length > 0 && Notification.permission === "granted") {
        new Notification(`⏰ ${fresh.length} 条跟进已到期`, {
          body: `该联系了: ${fresh.map((c) => c.name).join("、")}`,
          icon: "/icon.svg",
          tag: "follow-up",
        });
      }
      fresh.forEach((c) => notifiedIds.add(c.id));
      onDue(fresh);
    } catch {
      // 静默失败，下轮再试
    }
  }

  poll(); // 立即执行一次
  setInterval(poll, 5 * 60 * 1000); // 每5分钟轮询
}