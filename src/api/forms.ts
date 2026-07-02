// S9.1: 양식(Forms) API 클라이언트. 체크리스트 기반 점검표.
import { BACKEND_BASE } from "./drawings";

export type FormStatus = "미시작" | "진행중" | "제출" | "완료";
export type FormType = "점검" | "안전" | "품질" | "검사";

export const FORM_STATUSES: FormStatus[] = ["미시작", "진행중", "제출", "완료"];
export const FORM_TYPES: FormType[] = ["점검", "안전", "품질", "검사"];

export type FormItem = { label: string; checked: boolean };

export type BuildForm = {
  form_id: string;
  title: string;
  form_type: FormType;
  status: FormStatus;
  assignee: string;
  due_date: string;
  items: FormItem[];
  completion: number;
  project_name: string;
  created_at: string;
  updated_at: string;
};

export type FormSummary = {
  total: number;
  open: number;
  done: number;
  avg_completion: number;
  by_status: Record<string, number>;
};

export async function listForms(
  projectName = "Study_Project",
  filters: { status?: FormStatus; formType?: FormType } = {},
): Promise<BuildForm[]> {
  const url = new URL(`${BACKEND_BASE}/api/forms`);
  url.searchParams.set("project_name", projectName);
  if (filters.status) url.searchParams.set("status", filters.status);
  if (filters.formType) url.searchParams.set("form_type", filters.formType);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`양식 조회 실패 (${res.status})`);
  return res.json();
}

export async function formSummary(projectName = "Study_Project"): Promise<FormSummary> {
  const url = new URL(`${BACKEND_BASE}/api/forms/summary`);
  url.searchParams.set("project_name", projectName);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`양식 집계 실패 (${res.status})`);
  return res.json();
}

export async function createForm(input: {
  title: string;
  form_type?: FormType;
  status?: FormStatus;
  assignee?: string;
  due_date?: string;
  items?: FormItem[];
  projectName?: string;
}): Promise<BuildForm> {
  const res = await fetch(`${BACKEND_BASE}/api/forms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: input.title,
      form_type: input.form_type ?? "점검",
      status: input.status ?? "미시작",
      assignee: input.assignee ?? "",
      due_date: input.due_date ?? "",
      items: input.items ?? [],
      project_name: input.projectName ?? "Study_Project",
    }),
  });
  if (!res.ok) throw new Error(`양식 생성 실패 (${res.status}): ${await res.text()}`);
  return res.json();
}

export async function updateForm(
  formId: string,
  patch: Partial<Pick<BuildForm, "title" | "form_type" | "status" | "assignee" | "due_date" | "items">>,
): Promise<BuildForm> {
  const res = await fetch(`${BACKEND_BASE}/api/forms/${formId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`양식 수정 실패 (${res.status})`);
  return res.json();
}

export async function deleteForm(formId: string): Promise<void> {
  const res = await fetch(`${BACKEND_BASE}/api/forms/${formId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`양식 삭제 실패 (${res.status})`);
}
