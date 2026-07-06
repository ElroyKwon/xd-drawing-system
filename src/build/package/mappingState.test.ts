import { describe, expect, it } from "vitest";
import type { PackageDwg, PackagePdfSheet } from "../../api/packages";
import { assignDwg, isMapped, mappingSummary, removeDwg, setInheritKey, type Mapping } from "./mappingState";

const sheet = (id: string, num = "EE-01-000"): PackagePdfSheet => ({
  pdf_file_id: "PF", sheet_id: id, sheet_index: 0, sheet_number: num, sheet_title: "t",
  filename: "PF.pdf", png_url: null, source: "pdf-page",
});

describe("mappingState (S14 시트↔DWG 매핑 순수 전이)", () => {
  it("assigns a DWG link and marks the sheet mapped", () => {
    let m: Mapping = {};
    m = assignDwg(m, sheet("s1"), { dwg_file_id: "D1", layout_name: "L1" });
    expect(isMapped(m, "s1")).toBe(true);
    expect(m.s1.dwg_links).toEqual([{ dwg_file_id: "D1", layout_name: "L1" }]);
    expect(m.s1.sheet_number).toBe("EE-01-000");
  });

  it("dedupes identical (dwg_file_id + layout) links", () => {
    let m: Mapping = {};
    m = assignDwg(m, sheet("s1"), { dwg_file_id: "D1", layout_name: "L1" });
    const before = m;
    m = assignDwg(m, sheet("s1"), { dwg_file_id: "D1", layout_name: "L1" });
    expect(m).toBe(before);               // 변경 없음(참조 동일)
    expect(m.s1.dwg_links).toHaveLength(1);
  });

  it("supports N:M — multiple distinct DWGs on one sheet", () => {
    let m: Mapping = {};
    m = assignDwg(m, sheet("s1"), { dwg_file_id: "D1", layout_name: "L1" });
    m = assignDwg(m, sheet("s1"), { dwg_file_id: "D2", layout_name: null });
    expect(m.s1.dwg_links).toHaveLength(2);
  });

  it("removing the last link reverts the sheet to unmapped", () => {
    let m: Mapping = {};
    m = assignDwg(m, sheet("s1"), { dwg_file_id: "D1", layout_name: "L1" });
    m = removeDwg(m, "s1", { dwg_file_id: "D1", layout_name: "L1" });
    expect(isMapped(m, "s1")).toBe(false);
    expect(m.s1).toBeUndefined();
  });

  it("setInheritKey records the inherited sheet_key (계승)", () => {
    let m: Mapping = {};
    m = assignDwg(m, sheet("s1"), { dwg_file_id: "D1", layout_name: "L1" });
    m = setInheritKey(m, "s1", "sk_existing");
    expect(m.s1.inherit_sheet_key).toBe("sk_existing");
    // 엔트리 없으면 무시
    expect(setInheritKey(m, "ghost", "x")).toBe(m);
  });

  it("summarizes mapped count, unmapped sheets, and unlinked DWGs (loose)", () => {
    const sheets = [sheet("s1"), sheet("s2"), sheet("s3")];
    const dwgs: PackageDwg[] = [
      { dwg_file_id: "D1", filename: "a.dxf", layouts: [] },
      { dwg_file_id: "D2", filename: "b.dxf", layouts: [] },
    ];
    let m: Mapping = {};
    m = assignDwg(m, sheets[0], { dwg_file_id: "D1", layout_name: "L1" });
    const s = mappingSummary(sheets, dwgs, m);
    expect(s.mappedCount).toBe(1);
    expect(s.unmappedSheetIds).toEqual(["s2", "s3"]);
    expect(s.unlinkedDwgIds).toEqual(["D2"]);   // D1은 링크됨, D2는 미링크
  });
});
