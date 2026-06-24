export type Project = {
  id: string;
  name: string;
};

export type MemberRole = "관리자" | "편집자" | "뷰어";
export type MemberStatus = "활성" | "대기";

export type Member = {
  id: string;
  name: string;
  email: string;
  phone: string;
};

export type ProjectMemberAccess = {
  projectId: string;
  memberId: string;
  role: MemberRole;
  status: MemberStatus;
  addedAt: string;
};

export type ProjectAccessRow = ProjectMemberAccess & Member;

export const selectedProject: Project = {
  id: "project-study",
  name: "Study_Project"
};

export const memberRoles: MemberRole[] = ["관리자", "편집자", "뷰어"];

export const initialMembers: Member[] = [
  {
    id: "member-owner",
    name: "개혁 이",
    email: "cruelkh@gmail.com",
    phone: "+82 10-4112-9638"
  },
  {
    id: "member-reviewer",
    name: "도면 검토자",
    email: "reviewer@xd.local",
    phone: "+82 10-2000-1200"
  },
  {
    id: "member-field",
    name: "현장 담당자",
    email: "field@xd.local",
    phone: "+82 10-3000-3400"
  },
  {
    id: "member-viewer",
    name: "고객 열람자",
    email: "viewer@xd.local",
    phone: "+82 10-4000-5600"
  }
];

export const initialProjectAccess: ProjectMemberAccess[] = [
  {
    projectId: "project-study",
    memberId: "member-owner",
    role: "관리자",
    status: "활성",
    addedAt: "2026.06.12."
  },
  {
    projectId: "project-study",
    memberId: "member-reviewer",
    role: "편집자",
    status: "활성",
    addedAt: "2026.06.13."
  },
  {
    projectId: "project-seaport",
    memberId: "member-field",
    role: "관리자",
    status: "활성",
    addedAt: "2026.06.14."
  }
];

export function buildProjectAccessRows(
  projectId: string,
  members: Member[],
  accessRecords: ProjectMemberAccess[]
): ProjectAccessRow[] {
  return accessRecords
    .filter((access) => access.projectId === projectId)
    .map((access) => {
      const member = members.find((candidate) => candidate.id === access.memberId);
      if (!member) {
        return undefined;
      }

      return {
        ...access,
        ...member
      };
    })
    .filter((row): row is ProjectAccessRow => Boolean(row));
}

export function availableMembersForProject(
  projectId: string,
  members: Member[],
  accessRecords: ProjectMemberAccess[]
): Member[] {
  const assignedMemberIds = new Set(
    accessRecords
      .filter((access) => access.projectId === projectId)
      .map((access) => access.memberId)
  );

  return members.filter((member) => !assignedMemberIds.has(member.id));
}

export function memberHasProjectAccess(
  projectId: string,
  memberId: string,
  accessRecords: ProjectMemberAccess[]
): boolean {
  return accessRecords.some((access) => access.projectId === projectId && access.memberId === memberId);
}

// ─────────────────────────────────────────────────────────────
// 템플릿 상세(M2) 전용 시드 — 일반 프로젝트 모드 export는 변경 금지(A9 격리).
// ─────────────────────────────────────────────────────────────

export type TemplateMemberRow = {
  id: string;
  name: string;
  email: string;
  company: string;
  role: string;
  accessLevel: string;
};

export type TemplateCompanyRow = {
  id: string;
  name: string;
  industry: string;
  addedAt: string;
};

// 173409 캡처 실값: 회사="TEST-", 역할="관리자", 액세스="Project Admin".
export const templateMembers: TemplateMemberRow[] = [
  {
    id: "tmpl-member-owner",
    name: "개혁 이",
    email: "cruelkh@gmail.com",
    company: "TEST-",
    role: "관리자",
    accessLevel: "Project Admin"
  }
];

// 173455 캡처: 이름·업종·추가된 일시.
export const templateCompanies: TemplateCompanyRow[] = [
  {
    id: "tmpl-company-test",
    name: "TEST-",
    industry: "지정되지 않음",
    addedAt: "2026.06.19."
  }
];

// 알림 매트릭스(173517~173637) 주파수 드롭다운 고정 옵션 4종.
export const notificationFrequencies = ["즉시", "매시", "다양한", "매일"] as const;
export type NotificationFrequency = (typeof notificationFrequencies)[number];

export type NotificationEvent = {
  label: string;
  description: string;
};

export type NotificationTool = {
  name: string;
  frequency: NotificationFrequency;
  events: NotificationEvent[];
};

export type NotificationGroup = {
  id: string;
  name: string;
  frequency: NotificationFrequency;
  tools: NotificationTool[];
};

// "필요한 작업 알림" — 9개 도구(브리지·비용·양식·이슈·회의록·검토·RFI·일정 및 작업 계획·자료제출).
// 이벤트 라벨은 캡처(173601·173612) 한/영 혼재 그대로 재현, 미상값은 자리표시자.
const requiredActionTools: NotificationTool[] = [
  {
    name: "브리지",
    frequency: "즉시",
    events: [{ label: "검토 요청됨", description: "검토를 위해 전송된 Bridge 컨텐츠가 있습니다." }]
  },
  {
    name: "비용",
    frequency: "즉시",
    events: [
      { label: "Response to cost item required", description: "비용 항목에 대한 응답이 필요합니다." },
      { label: "A shared item requires your attention.", description: "내 비용 프로젝트에 Bridge 연결로 작성/업데이트된 항목이 주의를 필요로 합니다." }
    ]
  },
  {
    name: "양식",
    frequency: "다양한",
    events: [
      { label: "Form assigned to you", description: "양식이 사용자에게 할당되었습니다." },
      { label: "Comment mentioned", description: "댓글에서 언급되었습니다." },
      { label: "섹션 지정됨", description: "A form is created with sections assigned to you, your role, or your company." },
      { label: "상태가 변경됨", description: "The status of a form you're involved in changes." }
    ]
  },
  {
    name: "이슈",
    frequency: "매시",
    events: [
      { label: "Issue created or assigned to you", description: "이슈가 작성되거나 사용자에게 할당되었습니다." },
      { label: "Mentioned in an issue comment", description: "You're mentioned in a comment on an issue." }
    ]
  },
  {
    name: "회의록",
    frequency: "매시",
    events: [{ label: "Assigned to a meeting item", description: "회의 항목이 사용자에게 할당되었거나 지정되었습니다." }]
  },
  {
    name: "검토",
    frequency: "매시",
    events: [{ label: "Assigned to a review", description: "검토가 사용자에게 할당되었거나 지정되었습니다." }]
  },
  {
    name: "RFI",
    frequency: "매시",
    events: [
      { label: "Assigned to an RFI", description: "You're assigned, reassigned, or added as a reviewer to an RFI, making you the ball-in-court user." },
      { label: "Mentioned in RFI comment", description: "You, your role, or your company are mentioned in an RFI comment or response." }
    ]
  },
  {
    name: "일정 및 작업 계획",
    frequency: "다양한",
    events: [
      { label: "Mentioned in an activity comment", description: "You're mentioned by name in a comment on a schedule activity." },
      { label: "일정 계획이 게시됨", description: "프로젝트의 새 일정 계획이 게시되었습니다." }
    ]
  },
  {
    name: "자료제출",
    frequency: "매시",
    events: [{ label: "자료제출 항목 지정됨", description: "자료제출 항목이 사용자에게 지정되었습니다." }]
  }
];

// "기타 알림" — 15개 도구(브리지·서신·비용·Design Collaboration·파일·양식·이슈·회의록·AutoSpecs·검토·RFI·일정 및 작업 계획·시트·자료제출·자료전송).
const otherNotificationToolNames = [
  "브리지",
  "서신",
  "비용",
  "Design Collaboration",
  "파일",
  "양식",
  "이슈",
  "회의록",
  "AutoSpecs",
  "검토",
  "RFI",
  "일정 및 작업 계획",
  "시트",
  "자료제출",
  "자료전송"
];

const otherNotificationTools: NotificationTool[] = otherNotificationToolNames.map((name) => ({
  name,
  frequency: "즉시",
  events: []
}));

export const notificationGroups: NotificationGroup[] = [
  { id: "required-action", name: "필요한 작업 알림", frequency: "다양한", tools: requiredActionTools },
  { id: "other", name: "기타 알림", frequency: "다양한", tools: otherNotificationTools },
  { id: "reminders", name: "Upcoming and overdue item reminders", frequency: "매일", tools: [] }
];
