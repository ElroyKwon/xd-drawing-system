// 경량 안전 마크다운 렌더러 (S8.3-폴리시) — AI 챗 답변용.
// dangerouslySetInnerHTML 미사용(LLM 출력은 신뢰 불가 → XSS 안전). 신규 의존성 0.
// src/ai/**는 앱 다른 모듈을 import하지 않는다(프론트 격리 불변식) — 순수 함수만.
// 지원: #~###### 헤딩, GFM 표, **굵게**, `코드`, 불릿(- / *), 번호(1.), 문단/빈줄 구분. 그 외는 평문.
import type { ReactNode } from "react";

// GFM 표 한 행을 셀 배열로. 앞뒤 파이프 제거 후 | 로 분리.
function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

// lines[i]가 GFM 표(헤더+구분자행)의 시작이면 <table> 노드와 다음 인덱스를 반환. 아니면 null.
function tryParseTable(
  lines: string[],
  i: number,
  startKey: number,
): { node: ReactNode; nextIdx: number; key: number } | null {
  const headerLine = lines[i]?.trim();
  const sepLine = lines[i + 1]?.trim();
  if (!headerLine || !sepLine || !headerLine.includes("|")) return null;
  // 구분자 행은 각 셀이 대시(선택적 : 정렬)만으로 구성 — 이게 표의 결정적 신호.
  const sepCells = splitRow(sepLine);
  if (sepCells.length === 0 || !sepCells.every((c) => /^:?-{1,}:?$/.test(c))) return null;

  const headers = splitRow(headerLine);
  const rows: string[][] = [];
  let j = i + 2;
  for (; j < lines.length; j++) {
    const l = lines[j].trim();
    if (!l.includes("|")) break; // 표 밖으로 나감
    rows.push(splitRow(l));
  }
  let key = startKey;
  const node = (
    <div className="ai-table-wrap" key={`tw${key++}`}>
      <table className="ai-table">
        <thead>
          <tr>
            {headers.map((h, hi) => (
              <th key={hi}>{renderInline(h, `th${key}-${hi}`)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {headers.map((_, ci) => (
                <td key={ci}>{renderInline(r[ci] ?? "", `td${key}-${ri}-${ci}`)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return { node, nextIdx: j, key };
}

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

  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx];
    const line = raw.trimEnd();

    // 표: 헤더+구분자 행 lookahead. 소비하면 인덱스 점프.
    const table = tryParseTable(lines, idx, key);
    if (table) {
      flushList();
      blocks.push(table.node);
      key = table.key;
      idx = table.nextIdx - 1; // for 루프 ++ 보정
      continue;
    }

    // 헤딩 #~######: 드로어 폭 고려해 h3~h6로 매핑(h1/h2 과대 방지).
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushList();
      const level = Math.min(6, heading[1].length + 2);
      const Tag = `h${level}` as "h3" | "h4" | "h5" | "h6";
      blocks.push(<Tag key={`h${key++}`}>{renderInline(heading[2], `h${key}`)}</Tag>);
      continue;
    }

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
