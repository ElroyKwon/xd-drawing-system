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
});
