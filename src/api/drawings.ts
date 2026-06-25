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
