// S14: 발행분(Package/Transmittal) + 시트(PDF)↔소스 DWG 매핑 API 클라이언트.
// 격리: 오직 8000 백엔드 라우트만 호출(api/drawings.ts fetch 패턴 계승).

import { BACKEND_BASE } from "./drawings";

export type DwgLink = { dwg_file_id: string; layout_name?: string | null };

export type SheetSourceLink = {
  link_id: string;
  sheet_key: string;
  rev: string;
  package_id: string;
  project_name: string;
  pdf_file_id: string;
  sheet_id: string;
  sheet_index: number;
  sheet_number: string;
  dwg_links: DwgLink[];
  is_current: boolean;
  created_at: string;
};

// draft 매핑 엔트리(publish 전 편집 상태). sheet_key는 publish 시 확정.
export type MappingEntry = {
  sheet_id: string;
  pdf_file_id: string;
  sheet_index: number;
  sheet_number: string;
  dwg_links: DwgLink[];
  inherit_sheet_key?: string | null;
};

export type Package = {
  package_id: string;
  project_name: string;
  folder_id: string | null;
  title: string;
  issued_by: string;
  issued_at: string;
  created_at: string;
  published_at: string | null;
  dwg_file_ids: string[];
  pdf_file_ids: string[];
  draft_mapping: Record<string, MappingEntry>;
  status: "draft" | "published";
};

export type PackagePdfSheet = {
  pdf_file_id: string;
  filename: string;
  sheet_id: string;
  sheet_index: number;
  sheet_number: string;
  sheet_title: string;
  png_url?: string | null;
  source?: string;
};

export type PackageDwgLayout = { sheet_id: string; layout_name: string; source?: string; sheet_index: number };
export type PackageDwg = { dwg_file_id: string; filename: string | null; file_format?: string; layouts: PackageDwgLayout[] };

export type PackageDetail = Package & {
  pdf_sheets: PackagePdfSheet[];
  dwgs: PackageDwg[];
  sheet_sources: SheetSourceLink[];
};

export type HintMap = Record<string, { dwg_file_id: string; layout_name: string | null; score: number; reason: string }[]>;

export type PublishResult = {
  package_id: string;
  status: "published";
  published: number;
  links: SheetSourceLink[];
  unmapped_sheets: string[];
  unlinked_dwgs: string[];
};

async function jsonOrThrow<T>(res: Response, what: string): Promise<T> {
  if (!res.ok) throw new Error(`${what} 실패 (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function createPackage(input: {
  projectName?: string;
  title?: string;
  folderId?: string | null;
}): Promise<Package> {
  const res = await fetch(`${BACKEND_BASE}/api/packages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_name: input.projectName ?? "Study_Project",
      title: input.title ?? "",
      folder_id: input.folderId ?? null,
    }),
  });
  return jsonOrThrow(res, "세트 생성");
}

export async function listPackages(projectName = "Study_Project"): Promise<Package[]> {
  const url = new URL(`${BACKEND_BASE}/api/packages`);
  url.searchParams.set("project_name", projectName);
  return jsonOrThrow(await fetch(url.toString()), "세트 목록");
}

export async function getPackage(packageId: string): Promise<PackageDetail> {
  return jsonOrThrow(await fetch(`${BACKEND_BASE}/api/packages/${packageId}`), "세트 조회");
}

export async function addPackageFiles(
  packageId: string,
  files: { dwgFileIds?: string[]; pdfFileIds?: string[] },
): Promise<PackageDetail> {
  const res = await fetch(`${BACKEND_BASE}/api/packages/${packageId}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dwg_file_ids: files.dwgFileIds ?? [], pdf_file_ids: files.pdfFileIds ?? [] }),
  });
  return jsonOrThrow(res, "세트 파일 귀속");
}

export async function getPackageHints(packageId: string): Promise<HintMap> {
  return jsonOrThrow(await fetch(`${BACKEND_BASE}/api/packages/${packageId}/hints`), "매칭 힌트");
}

export async function savePackageMapping(
  packageId: string,
  mapping: Record<string, MappingEntry>,
): Promise<PackageDetail> {
  const res = await fetch(`${BACKEND_BASE}/api/packages/${packageId}/mapping`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mapping }),
  });
  return jsonOrThrow(res, "매핑 저장");
}

export async function publishPackage(packageId: string): Promise<PublishResult> {
  const res = await fetch(`${BACKEND_BASE}/api/packages/${packageId}/publish`, { method: "POST" });
  return jsonOrThrow(res, "세트 발행");
}

/** 시트 상세 "소스 DWG 열기" — 해당 시트의 소스 링크(dwg_links 보유 여부). */
export async function listSheetSources(
  projectName: string,
  sheetId: string,
): Promise<SheetSourceLink[]> {
  const url = new URL(`${BACKEND_BASE}/api/sheet-sources`);
  url.searchParams.set("project_name", projectName);
  url.searchParams.set("sheet_id", sheetId);
  return jsonOrThrow(await fetch(url.toString()), "소스 링크 조회");
}

/** 프로젝트의 모든 소스 링크(계승 대상 sheet_key 후보 목록용). */
export async function listProjectSheetSources(projectName: string): Promise<SheetSourceLink[]> {
  const url = new URL(`${BACKEND_BASE}/api/sheet-sources`);
  url.searchParams.set("project_name", projectName);
  return jsonOrThrow(await fetch(url.toString()), "소스 링크 조회");
}
