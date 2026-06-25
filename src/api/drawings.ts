// S1 백엔드(xd 로컬 FastAPI) 도면 API 클라이언트.
// 로컬 개발: http://127.0.0.1:8000 (CORS 허용됨).

export const BACKEND_BASE =
  (import.meta.env?.VITE_BACKEND_BASE as string | undefined) ?? "http://127.0.0.1:8000";

export type BackendSheet = {
  sheet_id: string;
  sheet_name: string;
  sheet_index: number;
  png_path?: string;
  png_url?: string | null;
  source?: string;
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
};

/** png_url(상대) → 백엔드 절대 URL */
export function sheetImageUrl(sheet: BackendSheet): string | undefined {
  return sheet.png_url ? `${BACKEND_BASE}${sheet.png_url}` : undefined;
}

export async function uploadDrawing(file: File, projectName = "Study_Project"): Promise<Drawing> {
  const form = new FormData();
  form.append("file", file);
  form.append("project_name", projectName);
  const res = await fetch(`${BACKEND_BASE}/api/drawings`, { method: "POST", body: form });
  if (!res.ok) {
    throw new Error(`업로드 실패 (${res.status}): ${await res.text()}`);
  }
  return res.json();
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

export async function listDrawings(projectName?: string): Promise<Drawing[]> {
  const url = new URL(`${BACKEND_BASE}/api/drawings`);
  if (projectName) {
    url.searchParams.set("project_name", projectName);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`목록 실패 (${res.status})`);
  }
  return res.json();
}
