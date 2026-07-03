// 경량 안전 마크다운 렌더러 (S8.3-폴리시) — AI 챗 답변용.
// dangerouslySetInnerHTML 미사용(LLM 출력은 신뢰 불가 → XSS 안전). 신규 의존성 0.
// src/ai/**는 앱 다른 모듈을 import하지 않는다(프론트 격리 불변식) — 순수 함수만.
// 지원: **굵게**, `코드`, 불릿(- / *), 번호(1.), 문단/빈줄 구분. 그 외는 평문.
import type { ReactNode } from "react";

// 한 줄 안의 **굵게** 와 `코드` 를 토큰화해 React 노드로.
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      nodes.push(<strong key={`${keyPrefix}-b${i}`}>{tok.slice(2, -2)}</strong>);
    } else {
      nodes.push(<code key={`${keyPrefix}-c${i}`}>{tok.slice(1, -1)}</code>);
    }
    last = m.index + tok.length;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function renderRichText(text: string): ReactNode {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let key = 0;

  const flushList = () => {
    if (!list) return;
    const { ordered, items } = list;
    blocks.push(
      ordered ? (
        <ol key={`ol${key++}`}>
          {items.map((it, j) => (
            <li key={j}>{renderInline(it, `oli${key}-${j}`)}</li>
          ))}
        </ol>
      ) : (
        <ul key={`ul${key++}`}>
          {items.map((it, j) => (
            <li key={j}>{renderInline(it, `uli${key}-${j}`)}</li>
          ))}
        </ul>
      ),
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (bullet) {
      if (!list || list.ordered) {
        flushList();
        list = { ordered: false, items: [] };
      }
      list.items.push(bullet[1]);
    } else if (numbered) {
      if (!list || !list.ordered) {
        flushList();
        list = { ordered: true, items: [] };
      }
      list.items.push(numbered[1]);
    } else {
      flushList();
      if (line.trim() === "") continue; // 빈 줄 = 문단 구분
      blocks.push(<p key={`p${key++}`}>{renderInline(line, `p${key}`)}</p>);
    }
  }
  flushList();
  return <>{blocks}</>;
}
