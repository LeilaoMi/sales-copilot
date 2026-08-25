"use client";

// 全局 fetch 封装 - 自动带 token、401 自动跳登录
import { getSupabaseBrowser } from "./supabase-browser";

export async function apiFetch(url: string, options: RequestInit = {}) {
  const supabase = getSupabaseBrowser();
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