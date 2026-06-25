import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MarkupCanvas from "./MarkupCanvas";
import type { Sheet } from "../../buildSheetsData";

const baseSheet: Sheet = {
  id: "s1",
  projectId: "p",
  number: "A04.01",
  title: "확대평면도",
  version: "1.0",
  versionSet: "-",
  disciplineCode: "A",
  disciplineLabel: "DWG",
  tag: "modelspace",
  lastUpdatedBy: "업로드",
};

const noop = () => {};

describe("MarkupCanvas — S1 실 도면 렌더", () => {
  it("imageUrl이 있으면 업로드·변환된 도면 PNG를 렌더한다", () => {
    render(
      <MarkupCanvas
        selectedSheet={{ ...baseSheet, imageUrl: "http://127.0.0.1:8000/files/x/a.png" }}
        markups={[]}
        issuePins={[]}
        selectedMarkupId={null}
        onSelectMarkup={noop}
      />,
    );
    const img = screen.getByRole("img", { name: /도면 렌더/ });
    expect(img).toHaveAttribute("src", "http://127.0.0.1:8000/files/x/a.png");
    // 실 도면 모드에서는 정적 플레이스홀더 텍스트를 띄우지 않는다.
    expect(screen.queryByText("정적 시트 렌더")).not.toBeInTheDocument();
  });

  it("imageUrl이 없으면 기존 정적 시트 외관을 유지한다", () => {
    render(
      <MarkupCanvas
        selectedSheet={baseSheet}
        markups={[]}
        issuePins={[]}
        selectedMarkupId={null}
        onSelectMarkup={noop}
      />,
    );
    expect(screen.getByText("정적 시트 렌더")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
