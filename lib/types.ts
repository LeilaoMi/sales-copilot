// 全项目共享类型定义
export type ClientStage = "lead" | "touched" | "proposal" | "negotiation" | "won" | "lost";
export type GenStatus = "generating" | "ready" | "failed";

export interface Client {
  id: string;
  name: string;
  company: string | null;
  title: string | null;
  industry: string | null;
  note: string | null;
  stage: ClientStage;
  status: GenStatus;
  profile: string | null;
  next_follow_up: string | null;
  created_at: string;
}

export interface Interaction {
  id: string;
  client_id: string;
  type: string;
  summary: string | null;
  commitments: string[] | null;
  objections: string[] | null;
  next_step: string | null;
  next_step_time: string | null;
  raw_content?: string | null;
  created_at: string;
}

export interface AnalyzeRequest {
  client_id?: string;      // 有值 = 对已有客户重新生成简报
  name: string;
  title?: string;
  company?: string;
  industry?: string;
  note?: string;
}

export const STAGE_LABELS: Record<ClientStage, string> = {
  lead: "线索",
  touched: "已接触",
  proposal: "已出方案",
  negotiation: "谈判中",
  won: "成交",
  lost: "失败",
};