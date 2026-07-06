// renderRichText 단위 테스트 (S8.3-폴리시) — raw 마크다운 노출 방지 회귀.
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { renderRichText } from "./markdown";

describe("renderRichText", () => {
  it("**굵게**를 <strong>으로 렌더하고 raw 별표를 노출하지 않는다", () => {
    const { container } = render(<div>{renderRichText("프로젝트 **Study_Project** 요약")}</div>);
    const strong = container.querySelector("strong");
    expect(strong?.textContent).toBe("Study_Project");
    expect(container.textContent).not.toContain("**");
  });

  it("불릿 목록을 <ul><li>로 렌더한다", () => {
    const { container } = render(
      <div>{renderRichText("- 파일 8개\n- 시트 15장\n- 폴더 14개")}</div>,
    );
    expect(container.querySelectorAll("ul li")).toHaveLength(3);
    expect(container.textContent).not.toContain("- ");
  });

  it("번호 목록을 <ol><li>로 렌더한다", () => {
    const { container } = render(<div>{renderRichText("1. 첫째\n2. 둘째")}</div>);
    expect(container.querySelectorAll("ol li")).toHaveLength(2);
  });

  it("`코드`를 <code>로 렌더한다", () => {
    const { container } = render(<div>{renderRichText("시트 ID: `s1_page_001`")}</div>);
    expect(container.querySelector("code")?.textContent).toBe("s1_page_001");
  });

  it("빈 줄로 문단을 구분한다", () => {
    const { container } = render(<div>{renderRichText("첫 문단\n\n둘째 문단")}</div>);
    expect(container.querySelectorAll("p")).toHaveLength(2);
  });

  it("GFM 표를 <table>로 렌더하고 raw 파이프를 노출하지 않는다", () => {
    const md = [
      "| 구분 | 태그 | 확인 도면 |",
      "|---|---|---|",
      "| 변압기 | MTR-1 | EE-01-001 |",
      "| 차단기 | VCB-22.9kV | EE-01-001, EE-01-002 |",
    ].join("\n");
    const { container } = render(<div>{renderRichText(md)}</div>);
    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    expect(container.querySelectorAll("thead th")).toHaveLength(3);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(container.querySelectorAll("tbody tr")[0].querySelectorAll("td")).toHaveLength(3);
    expect(table?.textContent).toContain("MTR-1");
    // 구분자 행(---)과 파이프가 화면에 노출되지 않는다
    expect(container.textContent).not.toContain("|");
    expect(container.textContent).not.toContain("---");
  });

  it("표 셀 안의 **굵게**도 <strong>으로 렌더한다", () => {
    const md = "| a | b |\n|---|---|\n| **굵은셀** | 일반 |";
    const { container } = render(<div>{renderRichText(md)}</div>);
    expect(container.querySelector("tbody td strong")?.textContent).toBe("굵은셀");
    expect(container.textContent).not.toContain("**");
  });

  it("정렬 구분자(:--, --:, :-:)가 있는 표도 렌더한다", () => {
    const md = "| 좌 | 중 | 우 |\n|:--|:-:|--:|\n| 1 | 2 | 3 |";
    const { container } = render(<div>{renderRichText(md)}</div>);
    expect(container.querySelector("table")).not.toBeNull();
    expect(container.querySelectorAll("thead th")).toHaveLength(3);
  });

  it("## 제목을 헤딩 요소로 렌더하고 raw #을 노출하지 않는다", () => {
    const { container } = render(<div>{renderRichText("## 설비 목록\n본문")}</div>);
    const h = container.querySelector("h4");
    expect(h?.textContent).toBe("설비 목록");
    expect(container.textContent).not.toContain("#");
  });
});
