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

export type VectorData = {
  strokes: VectorStroke[];
  fills: VectorFill[];
  points: { x: number; y: number; color: string; layer: string }[];
  layers: string[];
  bbox: [number, number, number, number] | null;
  stats: Record<string, unknown>;
};

/** DXF에서 추출한 벡터 엔티티(②경로). PDF/변환 미완이면 4xx. */
export async function fetchVector(fileId: string): Promise<VectorData> {
  const res = await fetch(`${BACKEND_BASE}/api/drawings/${fileId}/vector`);
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
