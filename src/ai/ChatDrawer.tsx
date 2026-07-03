// AI 챗 드로어 (S8.3) — 격리 사이드카(8001) 소비자. Build에서 단일 마운트.
// src/ai/**는 앱 다른 모듈을 import하지 않는다(프론트 격리 불변식).
import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, Loader2, AlertTriangle, Plus, History } from "lucide-react";
import {
  sendChat,
  aiHealth,
  listConversations,
  getConversation,
  type ChatToolCall,
  type ChatReference,
  type ConversationSummary,
} from "./aiClient";
import { renderRichText } from "./markdown";
import "./chat.css";

interface Msg {
  role: "user" | "assistant";
  content: string;
  tools?: ChatToolCall[];
  refs?: ChatReference[];
  error?: boolean;
}

// 답의 시트/이슈를 앱이 열도록 전역 이벤트 발행(격리: 앱 모듈 미의존, 이벤트로만 결합).
function navigateTo(ref: ChatReference) {
  window.dispatchEvent(new CustomEvent("xd:navigate", { detail: { type: ref.type, id: ref.id } }));
}

interface Props {
  project: string;
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function ChatDrawer({ project }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [width, setWidth] = useState<number | null>(null); // null = CSS 기본(400px)
  const [showList, setShowList] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function refreshList() {
    try {
      setConversations(await listConversations(project));
    } catch {
      setConversations([]);
    }
  }

  function toggleList() {
    const next = !showList;
    setShowList(next);
    if (next) refreshList();
  }

  async function openConversation(cid: string) {
    try {
      const conv = await getConversation(cid);
      setMessages(
        conv.messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
            tools: m.tool_calls,
            refs: m.references,
          })),
      );
      setConversationId(conv.id);
      setShowList(false);
    } catch {
      /* 목록 유지 */
    }
  }

  function newConversation() {
    setMessages([]);
    setConversationId(undefined);
    setShowList(false);
    inputRef.current?.focus();
  }

  // 왼쪽 가장자리 드래그로 폭 조절(드로어는 우측 고정 → 폭 = 창너비 - 마우스X).
  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    const onMove = (ev: MouseEvent) => {
      const max = Math.min(window.innerWidth * 0.92, 900);
      setWidth(Math.max(320, Math.min(window.innerWidth - ev.clientX, max)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // 열릴 때 8001/8000 도달성 점검 + 입력 포커스.
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    aiHealth()
      .then((h) => setDegraded(!h.ok || !h.backend_8000.reachable))
      .catch(() => setDegraded(true));
  }, [open]);

  // 새 메시지 시 스크롤 하단.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, loading]);

  // ESC로 닫기.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function submit() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setLoading(true);
    try {
      const res = await sendChat(project, text, conversationId);
      setConversationId(res.conversation_id);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: res.answer, tools: res.tool_calls, refs: res.references },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `AI 응답 실패: ${(e as Error).message}. 사이드카(8001)와 8000이 실행 중인지 확인하세요.`,
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="ai-fab"
        aria-label="AI 어시스턴트 열기"
        onClick={() => setOpen(true)}
      >
        <Sparkles size={18} />
        <span>AI 어시스턴트</span>
      </button>
    );
  }

  return (
    <aside
      className="ai-drawer"
      role="dialog"
      aria-label="AI 어시스턴트"
      aria-modal="false"
      style={width ? { width } : undefined}
    >
      <div
        className="ai-resize"
        role="separator"
        aria-label="어시스턴트 너비 조절"
        aria-orientation="vertical"
        onMouseDown={startResize}
      />
      <header className="ai-drawer-head">
        <span className="ai-drawer-title">
          <Sparkles size={16} /> AI 어시스턴트
        </span>
        <div className="ai-drawer-actions">
          <button
            type="button"
            className="ai-icon-btn"
            aria-label="새 대화"
            title="새 대화"
            onClick={newConversation}
          >
            <Plus size={16} />
          </button>
          <button
            type="button"
            className={`ai-icon-btn${showList ? " ai-icon-btn-on" : ""}`}
            aria-label="대화 목록"
            title="대화 목록"
            aria-pressed={showList}
            onClick={toggleList}
          >
            <History size={16} />
          </button>
          <button type="button" className="ai-icon-btn" aria-label="닫기" onClick={() => setOpen(false)}>
            <X size={16} />
          </button>
        </div>
      </header>

      {degraded ? (
        <div className="ai-degraded" role="status">
          <AlertTriangle size={14} /> 백엔드(8000/8001) 연결 확인 필요 — 응답이 제한될 수 있습니다.
        </div>
      ) : null}

      {showList ? (
        <div className="ai-conv-list">
          <button type="button" className="ai-conv-new" onClick={newConversation}>
            <Plus size={14} /> 새 대화 시작
          </button>
          {conversations.length === 0 ? (
            <p className="ai-conv-empty">저장된 대화가 없습니다.</p>
          ) : (
            <ul>
              {conversations.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`ai-conv-item${c.id === conversationId ? " ai-conv-item-on" : ""}`}
                    onClick={() => openConversation(c.id)}
                  >
                    <span className="ai-conv-when">{formatWhen(c.updated_at)}</span>
                    <span className="ai-conv-meta">메시지 {c.message_count}개</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
      <div className="ai-messages" ref={scrollRef} aria-live="polite">
        {messages.length === 0 ? (
          <div className="ai-empty">
            <p>이 프로젝트(<strong>{project}</strong>)의 도면·시트·이슈에 대해 물어보세요.</p>
            <ul>
              <li>“전기 공종 시트 몇 장이야?”</li>
              <li>“단선결선도 관련 이슈 있어?”</li>
              <li>“케이블 관련 이슈 알려줘”</li>
            </ul>
          </div>
        ) : null}
        {messages.map((m, i) => (
          <div key={i} className={`ai-msg ai-msg-${m.role}${m.error ? " ai-msg-error" : ""}`}>
            {m.tools && m.tools.length > 0 ? (
              <div className="ai-tools">
                {m.tools.map((t, j) => (
                  <span key={j} className="ai-tool-chip" title={JSON.stringify(t.arguments)}>
                    {t.name} · {t.result_summary}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="ai-bubble">
              {m.role === "assistant" && !m.error ? renderRichText(m.content) : m.content}
            </div>
            {m.refs && m.refs.length > 0 ? (
              <div className="ai-refs">
                {m.refs.map((r, j) => (
                  <button
                    key={j}
                    type="button"
                    className={`ai-ref ai-ref-${r.type}`}
                    onClick={() => navigateTo(r)}
                    title={r.type === "sheet" ? "시트 열기" : "이슈 열기"}
                  >
                    {r.type === "sheet" ? "📄" : "⚠"} {r.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        {loading ? (
          <div className="ai-msg ai-msg-assistant">
            <div className="ai-bubble ai-bubble-loading">
              <Loader2 size={14} className="ai-spin" /> 생각 중…
            </div>
          </div>
        ) : null}
      </div>
      )}

      <div className="ai-input-row">
        <textarea
          ref={inputRef}
          className="ai-input"
          placeholder="질문을 입력하세요 (Enter 전송, Shift+Enter 줄바꿈)"
          value={input}
          rows={2}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={loading}
        />
        <button
          type="button"
          className="ai-send"
          aria-label="전송"
          onClick={submit}
          disabled={loading || !input.trim()}
        >
          <Send size={16} />
        </button>
      </div>
    </aside>
  );
}
