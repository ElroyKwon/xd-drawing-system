// S14: 시트↔DWG 매핑 draft의 순수 상태 전이(테스트 대상 — 컴포넌트 무의존).
import type { DwgLink, MappingEntry, PackageDwg, PackagePdfSheet } from "../../api/packages";

export type Mapping = Record<string, MappingEntry>;

function linkKey(dl: DwgLink): string {
  return `${dl.dwg_file_id}::${dl.layout_name ?? ""}`;
}

/** 시트에 소스 DWG(레이아웃)를 지정. 중복(dwg_file_id+layout)이면 무시. */
export function assignDwg(mapping: Mapping, sheet: PackagePdfSheet, link: DwgLink): Mapping {
  const prev = mapping[sheet.sheet_id];
  const links = prev ? [...prev.dwg_links] : [];
  if (links.some((l) => linkKey(l) === linkKey(link))) return mapping;
  const entry: MappingEntry = {
    sheet_id: sheet.sheet_id,
    pdf_file_id: sheet.pdf_file_id,
    sheet_index: sheet.sheet_index,
    sheet_number: sheet.sheet_number,
    dwg_links: [...links, link],
    inherit_sheet_key: prev?.inherit_sheet_key ?? null,
  };
  return { ...mapping, [sheet.sheet_id]: entry };
}

/** 시트에서 소스 DWG 링크 1개 제거. 링크가 0개가 되면 엔트리 자체를 제거(미매핑으로 복귀). */
export function removeDwg(mapping: Mapping, sheetId: string, link: DwgLink): Mapping {
  const prev = mapping[sheetId];
  if (!prev) return mapping;
  const links = prev.dwg_links.filter((l) => linkKey(l) !== linkKey(link));
  const next = { ...mapping };
  if (links.length === 0) {
    delete next[sheetId];
  } else {
    next[sheetId] = { ...prev, dwg_links: links };
  }
  return next;
}

/** 계승할 기존 sheet_key 설정(null이면 신규 발급). 엔트리 없으면 무시. */
export function setInheritKey(mapping: Mapping, sheetId: string, sheetKey: string | null): Mapping {
  const prev = mapping[sheetId];
  if (!prev) return mapping;
  return { ...mapping, [sheetId]: { ...prev, inherit_sheet_key: sheetKey } };
}

/** 시트가 소스 DWG를 하나 이상 가지면 매핑됨. */
export function isMapped(mapping: Mapping, sheetId: string): boolean {
  return (mapping[sheetId]?.dwg_links.length ?? 0) > 0;
}

/** loose 요약: 매핑된 시트 수 / 미매핑 시트 id / 미링크 DWG id. */
export function mappingSummary(
  pdfSheets: PackagePdfSheet[],
  dwgs: PackageDwg[],
  mapping: Mapping,
): { mappedCount: number; unmappedSheetIds: string[]; unlinkedDwgIds: string[] } {
  const unmappedSheetIds = pdfSheets.filter((s) => !isMapped(mapping, s.sheet_id)).map((s) => s.sheet_id);
  const mappedCount = pdfSheets.length - unmappedSheetIds.length;
  const linked = new Set<string>();
  for (const e of Object.values(mapping)) {
    for (const l of e.dwg_links) linked.add(l.dwg_file_id);
  }
  const unlinkedDwgIds = dwgs.filter((d) => !linked.has(d.dwg_file_id)).map((d) => d.dwg_file_id);
  return { mappedCount, unmappedSheetIds, unlinkedDwgIds };
}
