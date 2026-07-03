// AI 챗 드로어 (S8.3) — 격리 사이드카(8001) 소비자. Build에서 단일 마운트.
// src/ai/**는 앱 다른 모듈을 import하지 않는다(프론트 격리 불변식).
import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, Loader2, AlertTriangle } from "lucide-react";
import { sendChat, aiHealth, type ChatToolCall } from "./aiClient";
import { renderRichText } from "./markdown";
import "./chat.css";

interface Msg {
  role: "user" | "assistant";
  content: string;
  tools?: ChatToolCall[];
  error?: boolean;
}

interface Props {
  project: string;
}

export default function ChatDrawer({ project }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
        { role: "assistant", content: res.answer, tools: res.tool_calls },
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
    <aside className="ai-drawer" role="dialog" aria-label="AI 어시스턴트" aria-modal="false">
      <header className="ai-drawer-head">
        <span className="ai-drawer-title">
          <Sparkles size={16} /> AI 어시스턴트
        </span>
        <button type="button" className="ai-icon-btn" aria-label="닫기" onClick={() => setOpen(false)}>
          <X size={16} />
        </button>
      </header>

      {degraded ? (
        <div className="ai-degraded" role="status">
          <AlertTriangle size={14} /> 백엔드(8000/8001) 연결 확인 필요 — 응답이 제한될 수 있습니다.
        </div>
      ) : null}

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
