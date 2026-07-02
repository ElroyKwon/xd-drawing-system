// S9.2: 사진(Photos) API 클라이언트. 업로드 이미지 + 선택적 시트 연결.
import { BACKEND_BASE } from "./drawings";

export type Photo = {
  photo_id: string;
  filename: string;
  file_format: string;
  file_size: number;
  title: string;
  caption: string;
  sheet_id: string | null;
  project_name: string;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  photo_url: string | null;
};

export type PhotoSummary = { total: number; linked: number; unlinked: number };

/** photo_url(상대) → 백엔드 절대 URL. null이면 undefined. */
export function photoSrc(photo: Photo): string | undefined {
  return photo.photo_url ? `${BACKEND_BASE}${photo.photo_url}` : undefined;
}

export async function listPhotos(projectName = "Study_Project", sheetId?: string): Promise<Photo[]> {
  const url = new URL(`${BACKEND_BASE}/api/photos`);
  url.searchParams.set("project_name", projectName);
  if (sheetId) url.searchParams.set("sheet_id", sheetId);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`사진 조회 실패 (${res.status})`);
  return res.json();
}

export async function photoSummary(projectName = "Study_Project"): Promise<PhotoSummary> {
  const url = new URL(`${BACKEND_BASE}/api/photos/summary`);
  url.searchParams.set("project_name", projectName);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`사진 집계 실패 (${res.status})`);
  return res.json();
}

export async function uploadPhoto(input: {
  file: File;
  title?: string;
  caption?: string;
  sheetId?: string;
  projectName?: string;
}): Promise<Photo> {
  const form = new FormData();
  form.append("file", input.file);
  form.append("project_name", input.projectName ?? "Study_Project");
  if (input.title) form.append("title", input.title);
  if (input.caption) form.append("caption", input.caption);
  if (input.sheetId) form.append("sheet_id", input.sheetId);
  const res = await fetch(`${BACKEND_BASE}/api/photos`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`사진 업로드 실패 (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function updatePhoto(
  photoId: string,
  patch: { title?: string; caption?: string; sheet_id?: string | null },
): Promise<Photo> {
  const res = await fetch(`${BACKEND_BASE}/api/photos/${photoId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`사진 수정 실패 (${res.status})`);
  return res.json();
}

export async function deletePhoto(photoId: string): Promise<void> {
  const res = await fetch(`${BACKEND_BASE}/api/photos/${photoId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`사진 삭제 실패 (${res.status})`);
}
