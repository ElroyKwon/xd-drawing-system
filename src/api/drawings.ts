// S1 백엔드(xd 로컬 FastAPI) 도면 API 클라이언트.
// 로컬 개발: http://127.0.0.1:8000 (CORS 허용됨).

import type { Sheet } from "../buildSheetsData";

export const BACKEND_BASE =
  (import.meta.env?.VITE_BACKEND_BASE as string | undefined) ?? "http://127.0.0.1:8000";

export type BackendSheet = {
  sheet_id: string;
  sheet_name: string;
  sheet_index: number;
  png_path?: string;
  png_url?: string | null;
  source?: string;
  // S2 시트 레지스터 메타(휴리스틱 추출)
  sheet_number?: string;
  sheet_title?: string;
  discipline_code?: string;
  discipline_label?: string;
  meta_source?: string;
};

export type Drawing = {
  file_id: string;
  filename: string;
  file_format: string;
  file_size: number;
  upload_date: string;
  project_name: string;
  version: string;
  conversion_status: "pending" | "converting" | "completed" | "failed";
  error?: string | null;
  sheets: BackendSheet[];
  scan?: Record<string, unknown>;
  // S3 버전세트/폴더/권한
  version_set_id?: string;
  version_no?: number;
  is_latest?: boolean;
  folder_id?: string | null;
  share_status?: string;
  uploaded_by?: string;
  // S2.5: 도면별 저장 용량(원본+파생 PNG/벡터) bytes.
  storage_bytes?: number;
};

// S3: 폴더 트리 + 권한 메타
export type FolderPermission = { role: string; level: string };
export type Folder = {
  folder_id: string;
  project_name: string;
  name: string;
  parent_id: string | null;
  share_status: string;
  permissions: FolderPermission[];
  updated_at: string;
  updated_by: string;
  seeded?: boolean;
};

/** png_url(상대) → 백엔드 절대 URL */
export function sheetImageUrl(sheet: BackendSheet): string | undefined {
  return sheet.png_url ? `${BACKEND_BASE}${sheet.png_url}` : undefined;
}

export async function uploadDrawing(
  file: File,
  projectName = "Study_Project",
  folderId?: string | null,
): Promise<Drawing> {
  const form = new FormData();
  form.append("file", file);
  form.append("project_name", projectName);
  if (folderId) form.append("folder_id", folderId);
  const res = await fetch(`${BACKEND_BASE}/api/drawings`, { method: "POST", body: form });
  if (!res.ok) {
    throw new Error(`업로드 실패 (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

// --- S3: 버전세트 ---

/** 같은 논리 파일에 새 버전을 명시적으로 추가(이전 버전 보관). */
export async function addDrawingVersion(fileId: string, file: File): Promise<Drawing> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BACKEND_BASE}/api/drawings/${fileId}/versions`, { method: "POST", body: form });
  if (!res.ok) {
    throw new Error(`버전 추가 실패 (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

/** 한 version_set의 모든 버전(version_no 내림차순). */
export async function listDrawingVersions(fileId: string): Promise<Drawing[]> {
  const res = await fetch(`${BACKEND_BASE}/api/drawings/${fileId}/versions`);
  if (!res.ok) {
    throw new Error(`버전 이력 실패 (${res.status})`);
  }
  return res.json();
}

/** 원본 파일 다운로드 URL. */
export function downloadUrl(fileId: string): string {
  return `${BACKEND_BASE}/api/drawings/${fileId}/download`;
}

export async function deleteDrawing(fileId: string): Promise<void> {
  const res = await fetch(`${BACKEND_BASE}/api/drawings/${fileId}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`삭제 실패 (${res.status})`);
  }
}

// --- S3: 폴더 트리 ---

export async function listFolders(projectName = "Study_Project"): Promise<Folder[]> {
  const url = new URL(`${BACKEND_BASE}/api/folders`);
  url.searchParams.set("project_name", projectName);
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`폴더 목록 실패 (${res.status})`);
  }
  return res.json();
}

export async function createFolder(input: {
  projectName?: string;
  name: string;
  parentId?: string | null;
}): Promise<Folder> {
  const res = await fetch(`${BACKEND_BASE}/api/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_name: input.projectName ?? "Study_Project",
      name: input.name,
      parent_id: input.parentId ?? null,
    }),
  });
  if (!res.ok) {
    throw new Error(`폴더 생성 실패 (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export async function updateFolder(
  folderId: string,
  patch: { name?: string; share_status?: string; parent_id?: string | null; permissions?: FolderPermission[] },
): Promise<Folder> {
  const res = await fetch(`${BACKEND_BASE}/api/folders/${folderId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    throw new Error(`폴더 수정 실패 (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export async function deleteFolder(folderId: string): Promise<void> {
  const res = await fetch(`${BACKEND_BASE}/api/folders/${folderId}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error(`폴더 삭제 실패 (${res.status})`);
  }
}

// --- S1.5 ②오픈소스 벡터 경로 ---

/** 벡터 폴리라인(선) — DXF 엔티티를 평탄화한 2D 좌표열. */
export type VectorStroke = { pts: [number, number][]; color: string; layer: string; width: number };
/** 벡터 채움 폴리곤(HATCH·SOLID·텍스트 path 등). */
export type VectorFill = { pts: [number, number][]; color: string; layer: string };

/** S4: DXF 측정 단위(model 1단위 = to_meter 미터). 미상이면 to_meter=null. */
export type VectorUnits = { insunits: number; name: string; to_meter: number | null };

export type VectorData = {
  strokes: VectorStroke[];
  fills: VectorFill[];
  points: { x: number; y: number; color: string; layer: string }[];
  layers: string[];
  bbox: [number, number, number, number] | null;
  units?: VectorUnits;
  stats: Record<string, unknown>;
};

// --- S4: 마크업 / 측정 / 비교 ---

export type MarkupGeometry = [number, number][];
export type MarkupStyle = { color?: string; width?: number; fill?: string; opacity?: number };

export type Markup = {
  markup_id: string;
  file_id: string;
  sheet_id: string;
  kind: string;
  coord_space: "world" | "image";
  geometry: MarkupGeometry;
  style: MarkupStyle;
  text: string;
  author: string;
  created_at: string;
};

export type Measurement = {
  measurement_id: string;
  file_id: string;
  sheet_id: string;
  type: string;
  geometry: MarkupGeometry;
  value: number;
  unit: string;
  created_at: string;
};

export type CompareResult = {
  file_id: string;
  against: string;
  sheet_index: number;
  mask_url: string | null;
  png_a_url: string | null;
  png_b_url: string | null;
  width: number;
  height: number;
  changed_pixels: number;
  total_pixels: number;
  changed_ratio: number;
  changed_bbox: number[] | null;
};

export async function listMarkups(fileId: string, sheetId: string): Promise<Markup[]> {
  const url = new URL(`${BACKEND_BASE}/api/drawings/${fileId}/markups`);
  url.searchParams.set("sheet_id", sheetId);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`마크업 조회 실패 (${res.status})`);
  return res.json();
}

export async function createMarkup(
  fileId: string,
  input: {
    sheet_id: string;
    kind: string;
    coord_space: "world" | "image";
    geometry: MarkupGeometry;
    style?: MarkupStyle;
    text?: string;
    author?: string;
  },
): Promise<Markup> {
  const res = await fetch(`${BACKEND_BASE}/api/drawings/${fileId}/markups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`마크업 생성 실패 (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function updateMarkup(
  fileId: string,
  markupId: string,
  patch: { geometry?: MarkupGeometry; style?: MarkupStyle; text?: string; kind?: string },
): Promise<Markup> {
  const res = await fetch(`${BACKEND_BASE}/api/drawings/${fileId}/markups/${markupId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`마크업 수정 실패 (${res.status})`);
  return res.json();
}

export async function deleteMarkup(fileId: string, markupId: string): Promise<void> {
  const res = await fetch(`${BACKEND_BASE}/api/drawings/${fileId}/markups/${markupId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`마크업 삭제 실패 (${res.status})`);
}

export async function listMeasurements(fileId: string, sheetId: string): Promise<Measurement[]> {
  const url = new URL(`${BACKEND_BASE}/api/drawings/${fileId}/measurements`);
  url.searchParams.set("sheet_id", sheetId);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`측정 조회 실패 (${res.status})`);
  return res.json();
}

export async function createMeasurement(
  fileId: string,
  input: { sheet_id: string; type: string; geometry: MarkupGeometry; value: number; unit: string },
): Promise<Measurement> {
  const res = await fetch(`${BACKEND_BASE}/api/drawings/${fileId}/measurements`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`측정 생성 실패 (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function deleteMeasurement(fileId: string, measurementId: string): Promise<void> {
  const res = await fetch(`${BACKEND_BASE}/api/drawings/${fileId}/measurements/${measurementId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`측정 삭제 실패 (${res.status})`);
}

// --- S5: 이슈 영속 + 뷰어 핀 연계 (독립 Issue 엔티티) ---

export type IssueStatus = "열림" | "진행중" | "답변됨" | "닫힘" | "삭제됨";
export type IssuePin = { point: [number, number]; coord_space: "world" | "image" };
export type IssueComment = { comment_id: string; author_id: string | null; author_name: string; body: string; created_at: string };
export type IssueResolution = { file_id: string; version_no: string | number; note: string };

export type Issue = {
  issue_id: string;
  file_id: string | null;
  sheet_id: string | null;
  title: string;
  type: string;
  status: IssueStatus;
  category: string;
  assignee: string;
  author: string;
  description: string;
  project_name: string;
  pin: IssuePin | null;
  created_at: string;
  updated_at: string;
  comments?: IssueComment[];
  sheet_key?: string | null;
  resolution?: IssueResolution | null;
};

/** ACC식 상태 전이(클라 가드 — 백엔드가 권위 검증). */
export const ISSUE_STATUS_TRANSITIONS: Record<string, IssueStatus[]> = {
  열림: ["진행중", "답변됨", "닫힘"],
  진행중: ["답변됨", "닫힘", "열림"],
  답변됨: ["닫힘", "진행중", "열림"],
  닫힘: ["열림"],
  삭제됨: ["열림"],
};

export type IssueFilters = {
  status?: IssueStatus;
  fileId?: string;
  sheetId?: string;
  sheetKey?: string;
  category?: string;
  projectName?: string;
};

export async function listIssues(filters: IssueFilters = {}): Promise<Issue[]> {
  const url = new URL(`${BACKEND_BASE}/api/issues`);
  if (filters.status) url.searchParams.set("status", filters.status);
  if (filters.fileId) url.searchParams.set("file_id", filters.fileId);
  if (filters.sheetId) url.searchParams.set("sheet_id", filters.sheetId);
  if (filters.sheetKey) url.searchParams.set("sheet_key", filters.sheetKey);
  if (filters.category) url.searchParams.set("category", filters.category);
  if (filters.projectName) url.searchParams.set("project_name", filters.projectName);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`이슈 조회 실패 (${res.status})`);
  return res.json();
}

export async function getIssue(issueId: string): Promise<Issue> {
  const res = await fetch(`${BACKEND_BASE}/api/issues/${issueId}`);
  if (!res.ok) throw new Error(`이슈 조회 실패 (${res.status})`);
  return res.json();
}

export async function addIssueComment(issueId: string, body: string): Promise<Issue> {
  const res = await fetch(`${BACKEND_BASE}/api/issues/${issueId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(`댓글 작성 실패 (${res.status}): ${await res.text()}`);
  return res.json();
}

/** 카테고리별 진행 중 이슈 수(닫힘/삭제 제외) 실집계. */
export async function issueCategoryCounts(projectName?: string): Promise<Record<string, number>> {
  const url = new URL(`${BACKEND_BASE}/api/issues/categories`);
  if (projectName) url.searchParams.set("project_name", projectName);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`카테고리 집계 실패 (${res.status})`);
  return res.json();
}

export async function createIssue(input: {
  title: string;
  type?: string;
  category?: string;
  assignee?: string;
  description?: string;
  status?: IssueStatus;
  projectName?: string;
  fileId?: string | null;
  sheetId?: string | null;
  pin?: IssuePin | null;
}): Promise<Issue> {
  const res = await fetch(`${BACKEND_BASE}/api/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: input.title,
      type: input.type ?? "설계 검토",
      category: input.category ?? "",
      assignee: input.assignee ?? "",
      description: input.description ?? "",
      status: input.status ?? "열림",
      project_name: input.projectName ?? "Study_Project",
      file_id: input.fileId ?? null,
      sheet_id: input.sheetId ?? null,
      pin: input.pin ?? null,
    }),
  });
  if (!res.ok) throw new Error(`이슈 생성 실패 (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function updateIssue(
  issueId: string,
  patch: { title?: string; type?: string; category?: string; assignee?: string; description?: string; status?: IssueStatus; pin?: IssuePin; resolution?: IssueResolution | null },
): Promise<Issue> {
  const res = await fetch(`${BACKEND_BASE}/api/issues/${issueId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`이슈 수정 실패 (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function deleteIssue(issueId: string): Promise<void> {
  const res = await fetch(`${BACKEND_BASE}/api/issues/${issueId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`이슈 삭제 실패 (${res.status})`);
}

// --- S6: 프로젝트 전역 검색 ---

export type SearchSheetHit = { file_id: string; sheet_id: string; number: string; title: string; label: string };
export type SearchIssueHit = { issue_id: string; file_id: string | null; sheet_id: string | null; title: string; status: string; label: string };
export type SearchFileHit = { file_id: string; folder_id: string | null; filename: string; label: string };
export type SearchFolderHit = { folder_id: string; name: string; label: string };
export type SearchResults = {
  query: string;
  sheets: SearchSheetHit[];
  issues: SearchIssueHit[];
  files: SearchFileHit[];
  folders: SearchFolderHit[];
  truncated: boolean;
};

/** 시트·이슈·파일·폴더를 가로지르는 전역 검색(서버측 부분일치). */
export async function searchProject(projectName: string, q: string): Promise<SearchResults> {
  const url = new URL(`${BACKEND_BASE}/api/search`);
  url.searchParams.set("q", q);
  url.searchParams.set("project_name", projectName);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`검색 실패 (${res.status})`);
  return res.json();
}

/** 같은 version_set 두 버전 PNG 픽셀 diff(백엔드 마스크 + 변경 통계). */
export async function compareVersions(
  fileId: string,
  against: string,
  sheetIndex = 0,
): Promise<CompareResult> {
  const url = new URL(`${BACKEND_BASE}/api/drawings/${fileId}/compare`);
  url.searchParams.set("against", against);
  url.searchParams.set("sheet_index", String(sheetIndex));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`비교 실패 (${res.status}): ${await res.text()}`);
  return res.json();
}

/** png_url(상대) → 백엔드 절대 URL. null이면 undefined. */
export function fileUrl(relUrl: string | null | undefined): string | undefined {
  return relUrl ? `${BACKEND_BASE}${relUrl}` : undefined;
}

/** DXF에서 추출한 벡터 엔티티(②경로). PDF/변환 미완이면 4xx. */
export async function fetchVector(fileId: string): Promise<VectorData> {
  // 벡터 JSON은 재변환/스키마 변경으로 갱신될 수 있어 항상 재검증한다(휴리스틱 stale 캐시 방지).
  const res = await fetch(`${BACKEND_BASE}/api/drawings/${fileId}/vector`, { cache: "no-cache" });
  if (!res.ok) {
    throw new Error(`벡터 조회 실패 (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

export async function getDrawing(fileId: string): Promise<Drawing> {
  const res = await fetch(`${BACKEND_BASE}/api/drawings/${fileId}`);
  if (!res.ok) {
    throw new Error(`조회 실패 (${res.status})`);
  }
  return res.json();
}

/** 백엔드 도면 목록(완료분)을 프론트 Sheet[]로 매핑(S2 시트 레지스터 실데이터). */
export function drawingsToSheets(drawings: Drawing[], projectId: string): Sheet[] {
  const sheets: Sheet[] = [];
  for (const d of drawings) {
    if (d.conversion_status !== "completed") continue;
    for (const s of d.sheets) {
      sheets.push({
        id: s.sheet_id,
        projectId,
        number: s.sheet_number || s.sheet_name || d.filename,
        title: s.sheet_title || d.filename,
        version: d.version || "1",
        versionSet: "-",
        disciplineCode: s.discipline_code || "G",
        disciplineLabel: s.discipline_label || "G (기타)",
        tag: s.source || d.file_format,
        lastUpdatedBy: "업로드",
        imageUrl: sheetImageUrl(s),
        fileId: d.file_id,
        source: s.source,
        sheetIndex: s.sheet_index,
        versionSetId: d.version_set_id || d.file_id,
      });
    }
  }
  return sheets;
}

export async function listDrawings(
  projectName?: string,
  opts?: { folderId?: string | null; latestOnly?: boolean },
): Promise<Drawing[]> {
  const url = new URL(`${BACKEND_BASE}/api/drawings`);
  if (projectName) {
    url.searchParams.set("project_name", projectName);
  }
  if (opts?.folderId !== undefined && opts.folderId !== null) {
    url.searchParams.set("folder_id", opts.folderId);
  }
  if (opts?.latestOnly) {
    url.searchParams.set("latest_only", "true");
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`목록 실패 (${res.status})`);
  }
  return res.json();
}
