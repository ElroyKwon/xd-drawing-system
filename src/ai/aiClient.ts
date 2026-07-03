// AI 사이드카(8001) 클라이언트 — 격리. src/ai/**는 앱 다른 모듈을 import하지 않는다.
// 8001은 8000과 별개 프로세스(격리 불변식). 베이스 URL은 VITE_AI_BASE로 재정의 가능.

const AI_BASE =
  (import.meta.env?.VITE_AI_BASE as string | undefined) ?? "http://127.0.0.1:8001";

export interface ChatToolCall {
  name: string;
  arguments: Record<string, unknown>;
  result_summary: string;
}

export interface ChatReference {
  type: "sheet" | "issue";
  id: string;
  label: string;
}

export interface ChatResponse {
  conversation_id: string;
  answer: string;
  tool_calls: ChatToolCall[];
  references: ChatReference[];
  provider: string;
}

export async function sendChat(
  project: string,
  message: string,
  conversationId?: string,
): Promise<ChatResponse> {
  const res = await fetch(`${AI_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, message, conversation_id: conversationId }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`AI ${res.status}: ${detail.slice(0, 200)}`);
  }
  return res.json();
}

export interface ConversationSummary {
  id: string;
  project: string;
  owner?: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface ConversationMessage {
  role: "user" | "assistant" | string;
  content: string;
  ts?: string;
  tool_calls?: ChatToolCall[];
  references?: ChatReference[];
}

export interface Conversation {
  id: string;
  project: string;
  owner?: string;
  created_at: string;
  updated_at: string;
  messages: ConversationMessage[];
}

export async function listConversations(project: string): Promise<ConversationSummary[]> {
  const res = await fetch(
    `${AI_BASE}/api/chat/conversations?project=${encodeURIComponent(project)}`,
  );
  if (!res.ok) throw new Error(`대화 목록 ${res.status}`);
  return res.json();
}

export async function getConversation(cid: string): Promise<Conversation> {
  const res = await fetch(`${AI_BASE}/api/chat/conversations/${encodeURIComponent(cid)}`);
  if (!res.ok) throw new Error(`대화 조회 ${res.status}`);
  return res.json();
}

export interface AiHealth {
  ok: boolean;
  backend_8000: { reachable: boolean; current_user?: string };
}

export async function aiHealth(): Promise<AiHealth> {
  const res = await fetch(`${AI_BASE}/api/chat/health`);
  if (!res.ok) throw new Error(`health ${res.status}`);
  return res.json();
}
