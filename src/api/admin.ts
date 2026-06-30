// S7: 로컬 모의 인증 + 프로젝트/구성원 영속 API 클라이언트.
import { BACKEND_BASE } from "./drawings";

export type MemberRole = "관리자" | "편집자" | "뷰어";
export type MemberStatus = "활성" | "대기";

export type Member = { id: string; name: string; email: string; phone: string };
export type ProjectMemberRow = Member & {
  project_name: string;
  member_id: string;
  role: MemberRole;
  status: MemberStatus;
  added_at: string;
};
export type Me = { member_id: string; member: Member | null; roles: Record<string, MemberRole> };

async function jsonOrThrow(res: Response, msg: string) {
  if (!res.ok) throw new Error(`${msg} (${res.status}): ${await res.text()}`);
  return res.json();
}

// --- 인증(로컬 모의 현재 사용자) ---
export async function getMe(): Promise<Me> {
  return jsonOrThrow(await fetch(`${BACKEND_BASE}/api/auth/me`), "현재 사용자 조회 실패");
}
export async function switchUser(memberId: string): Promise<Me> {
  return jsonOrThrow(
    await fetch(`${BACKEND_BASE}/api/auth/me`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ member_id: memberId }),
    }),
    "사용자 전환 실패",
  );
}

// --- 프로젝트 ---
export async function listProjects<T = Record<string, unknown>>(): Promise<T[]> {
  return jsonOrThrow(await fetch(`${BACKEND_BASE}/api/projects`), "프로젝트 목록 실패");
}
export async function createProject<T = Record<string, unknown>>(project: T): Promise<T> {
  return jsonOrThrow(
    await fetch(`${BACKEND_BASE}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(project),
    }),
    "프로젝트 생성 실패",
  );
}

// --- 구성원 ---
export async function listMembers(): Promise<Member[]> {
  return jsonOrThrow(await fetch(`${BACKEND_BASE}/api/members`), "구성원 목록 실패");
}
export async function listProjectMembers(projectName: string): Promise<ProjectMemberRow[]> {
  return jsonOrThrow(
    await fetch(`${BACKEND_BASE}/api/projects/${encodeURIComponent(projectName)}/members`),
    "프로젝트 구성원 조회 실패",
  );
}
export async function addProjectMember(
  projectName: string,
  input: { member_id: string; role?: MemberRole; status?: MemberStatus },
): Promise<ProjectMemberRow> {
  return jsonOrThrow(
    await fetch(`${BACKEND_BASE}/api/projects/${encodeURIComponent(projectName)}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
    "구성원 추가 실패",
  );
}
export async function patchProjectMember(
  projectName: string,
  memberId: string,
  patch: { role?: MemberRole; status?: MemberStatus },
): Promise<ProjectMemberRow> {
  return jsonOrThrow(
    await fetch(`${BACKEND_BASE}/api/projects/${encodeURIComponent(projectName)}/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }),
    "역할 변경 실패",
  );
}
export async function removeProjectMember(projectName: string, memberId: string): Promise<void> {
  const res = await fetch(
    `${BACKEND_BASE}/api/projects/${encodeURIComponent(projectName)}/members/${memberId}`,
    { method: "DELETE" },
  );
  if (!res.ok) throw new Error(`구성원 제거 실패 (${res.status})`);
}
