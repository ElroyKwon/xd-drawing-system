import {
  Activity,
  ArrowLeft,
  ArrowLeftRight,
  Bell,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Filter,
  HardHat,
  Info,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Settings,
  UserRound,
  Users,
  X,
  type LucideIcon
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useModalDismiss } from "./hooks/useModalDismiss";
import {
  addProjectMember,
  listMembers,
  listProjectMembers,
  patchProjectMember,
  type Member,
  type MemberRole
} from "./api/admin";
import {
  memberRoles,
  notificationFrequencies,
  notificationGroups,
  selectedProject,
  templateCompanies,
  templateMembers,
  type ProjectAccessRow,
  type ProjectMemberAccess
} from "./projectAdminData";

type ProjectAdminProject = {
  id: string;
  name: string;
};

type ProjectAdminViewProps = {
  onBackToProjects: () => void;
  mode?: "project" | "template";
  templateName?: string;
  project?: ProjectAdminProject;
  accessRecords?: ProjectMemberAccess[];
  onAccessRecordsChange?: (records: ProjectMemberAccess[]) => void;
  canManage?: boolean;   // S7: 현재 사용자가 이 프로젝트 관리자인가(구성원 관리 권한)
};

type AddMemberForm = {
  memberId: string;
  role: ProjectMemberAccess["role"];
};

const adminSections = ["구성원", "회사", "브리지", "액티비티", "알림", "위치", "설정"] as const;

const adminSectionIcons = {
  구성원: Users,
  회사: Building2,
  브리지: ArrowLeftRight,
  액티비티: Activity,
  알림: Bell,
  위치: MapPin,
  설정: Settings
} as const;

type AdminSection = (typeof adminSections)[number];

const emptyAddMemberForm: AddMemberForm = {
  memberId: "",
  role: "뷰어"
};

export default function ProjectAdminView(props: ProjectAdminViewProps) {
  if (props.mode === "template") {
    return <TemplateAdminView templateName={props.templateName ?? "프로젝트 템플릿"} onBackToProjects={props.onBackToProjects} />;
  }
  return <ProjectMemberAdminView {...props} />;
}

function ProjectMemberAdminView({
  project = selectedProject,
  canManage = true,
  onBackToProjects
}: ProjectAdminViewProps) {
  // S7: 구성원은 백엔드 영속(project_member). 역할 변경/추가는 관리자만(canManage·서버 403).
  const [rows, setRows] = useState<ProjectAccessRow[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [query, setQuery] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("member-owner");
  const [activeSection, setActiveSection] = useState<AdminSection>("구성원");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddMemberForm>(emptyAddMemberForm);
  const [addError, setAddError] = useState("");

  const reload = useCallback(() => {
    listProjectMembers(project.name)
      .then((pm) =>
        setRows(
          pm.map((r) => ({
            projectId: project.id, memberId: r.member_id, role: r.role, status: r.status,
            addedAt: r.added_at, id: r.id, name: r.name, email: r.email, phone: r.phone,
          })),
        ),
      )
      .catch(() => setRows([]));
  }, [project.name, project.id]);

  useEffect(() => {
    reload();
    listMembers().then(setAllMembers).catch(() => {});
  }, [reload]);

  const accessRows = rows;

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return accessRows;
    return accessRows.filter(
      (row) => row.name.toLowerCase().includes(normalized) || row.email.toLowerCase().includes(normalized),
    );
  }, [accessRows, query]);

  const selectedRow = accessRows.find((row) => row.memberId === selectedMemberId) ?? accessRows[0];

  const availableMembers = useMemo(() => {
    const assigned = new Set(rows.map((r) => r.memberId));
    return allMembers.filter((m) => !assigned.has(m.id));
  }, [rows, allMembers]);

  function openAddModal() {
    setAddForm(emptyAddMemberForm);
    setAddError("");
    setIsAddModalOpen(true);
  }

  function closeAddModal() {
    setAddForm(emptyAddMemberForm);
    setAddError("");
    setIsAddModalOpen(false);
  }

  async function submitAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!addForm.memberId) {
      setAddError("구성원을 선택하세요.");
      return;
    }
    try {
      await addProjectMember(project.name, { member_id: addForm.memberId, role: addForm.role });
      setSelectedMemberId(addForm.memberId);
      closeAddModal();
      reload();
    } catch (e) {
      setAddError(e instanceof Error ? e.message : "구성원 추가 실패");
    }
  }

  async function changeRole(memberId: string, role: MemberRole) {
    try {
      await patchProjectMember(project.name, memberId, { role });
      reload();
    } catch {/* 권한 없음(403) 등 — 무시, 목록 유지 */}
  }

  return (
    <main className="admin-shell">
      <aside className="admin-rail" aria-label="Project Admin 메뉴">
        <div className="admin-product">
          <span className="admin-product-mark" aria-hidden="true">
            <Settings size={17} />
          </span>
          <span>Project Admin</span>
        </div>
        {adminSections.map((item) => {
          const SectionIcon = adminSectionIcons[item];
          return (
            <button
              key={item}
              type="button"
              aria-current={item === activeSection ? "page" : undefined}
              onClick={() => setActiveSection(item)}
            >
              <SectionIcon size={17} aria-hidden="true" />
              <span>{item}</span>
            </button>
          );
        })}
      </aside>

      <section className="admin-workspace">
        <header className="admin-topline">
          <div className="project-context-stack">
            <button className="ghost-action" type="button" onClick={onBackToProjects}>
              <ArrowLeft size={16} aria-hidden="true" />
              <span>프로젝트 목록</span>
            </button>
            <span className="level-kicker">Project 레벨</span>
            <strong>{project.name}</strong>
          </div>
          <span className="settings-scope-chip">프로젝트 관리</span>
        </header>

        <div className="admin-content-grid">
          <section className="admin-main">
            {activeSection === "구성원" ? (
              <section className="admin-panel" aria-label="Project Admin 구성원 목록">
                <div className="admin-heading">
                  <div>
                    <span className="admin-page-kicker">Project access</span>
                    <h1 id="member-access-title">구성원</h1>
                  </div>
                  <button
                    className="primary-action"
                    type="button"
                    onClick={openAddModal}
                    disabled={!canManage}
                    title={canManage ? undefined : "구성원 추가는 관리자만 가능합니다"}
                  >
                    <Plus size={16} aria-hidden="true" />
                    <span>구성원 추가</span>
                  </button>
                </div>

                <div className="admin-tools">
                  <button className="secondary-action admin-export" type="button">
                    <Download size={16} aria-hidden="true" />
                    <span>내보내기</span>
                  </button>
                  <label className="search-field admin-search">
                    <Search size={18} aria-hidden="true" />
                    <input
                      aria-label="구성원 검색"
                      name="project-member-search"
                      placeholder="이름 또는 이메일로 구성원 검색..."
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </label>
                  <button className="icon-button" type="button" aria-label="필터">
                    <Filter size={18} />
                  </button>
                </div>

                <div className="table-scroll admin-table-scroll">
                  <table className="project-table admin-member-table">
                    <colgroup>
                      <col className="admin-member-col-name" />
                      <col className="admin-member-col-email" />
                      <col className="admin-member-col-phone" />
                      <col className="admin-member-col-status" />
                      <col className="admin-member-col-role" />
                      <col className="admin-member-col-date" />
                      <col className="admin-member-col-action" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th scope="col">이름</th>
                        <th scope="col">이메일</th>
                        <th scope="col">전화</th>
                        <th scope="col">상태</th>
                        <th scope="col">역할</th>
                        <th scope="col">추가된 일시</th>
                        <th scope="col" aria-label="설정">
                          <Settings size={17} />
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row) => (
                        <tr
                          key={row.memberId}
                          data-testid="project-access-row"
                          className={row.memberId === selectedRow?.memberId ? "selected-row" : undefined}
                          onClick={() => setSelectedMemberId(row.memberId)}
                        >
                          <td>
                            <span className="admin-member-identity">
                              <span className="admin-member-mini-avatar" aria-hidden="true">{row.name.slice(0, 1)}</span>
                              <strong>{row.name}</strong>
                            </span>
                          </td>
                          <td>{row.email}</td>
                          <td>{row.phone}</td>
                          <td><span className="admin-status-badge">{row.status}</span></td>
                          <td><span className="admin-role-badge">{row.role}</span></td>
                          <td>{row.addedAt}</td>
                          <td><ChevronRight size={16} aria-hidden="true" /></td>
                        </tr>
                      ))}
                      {filteredRows.length === 0 ? (
                        <tr>
                          <td className="admin-table-empty" colSpan={7}>검색 조건에 맞는 구성원이 없습니다.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : (
              <ProjectAdminSectionPanel activeSection={activeSection} />
            )}
          </section>

          {activeSection === "구성원" ? (
            <MemberInspector row={selectedRow} canManage={canManage} onRoleChange={changeRole} />
          ) : (
            <AdminSectionInspector activeSection={activeSection} />
          )}
        </div>
      </section>

      {isAddModalOpen ? (
        <AddMemberModal
          form={addForm}
          error={addError}
          availableMembers={availableMembers}
          onClose={closeAddModal}
          onSubmit={submitAddMember}
          onUpdate={setAddForm}
        />
      ) : null}
    </main>
  );
}

function ProjectAdminSectionPanel({ activeSection }: { activeSection: Exclude<AdminSection, "구성원"> }) {
  if (activeSection === "회사") {
    const companies = [
      { name: "Delta Engineers", trade: "설계·엔지니어링", members: 8, access: "프로젝트 구성원", status: "활성" },
      { name: "Crystal Clear Glazing", trade: "외장·유리", members: 4, access: "제한된 액세스", status: "활성" },
      { name: "Forma Sample Contractor", trade: "종합 시공", members: 12, access: "프로젝트 구성원", status: "활성" }
    ];
    return (
      <AdminSectionFrame
        activeSection={activeSection}
        kicker="Project directory"
        description="프로젝트 회사 관리"
        action={<button className="primary-action" type="button"><Plus size={16} /><span>회사 추가</span></button>}
      >
        <div className="admin-section-toolbar">
          <label className="search-field">
            <Search size={17} aria-hidden="true" />
            <input aria-label="회사 검색" name="project-company-search" placeholder="회사명 또는 전문 분야 검색..." />
          </label>
          <button className="icon-button" type="button" aria-label="회사 필터"><Filter size={17} /></button>
        </div>
        <div className="table-scroll admin-section-table-scroll">
          <table className="project-table admin-company-table">
            <thead>
              <tr>
                <th scope="col">회사명</th>
                <th scope="col">전문 분야</th>
                <th scope="col">구성원</th>
                <th scope="col">액세스</th>
                <th scope="col">상태</th>
                <th scope="col" aria-label="작업" />
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.name}>
                  <td>
                    <span className="admin-company-identity">
                      <span className="admin-company-mark" aria-hidden="true"><Building2 size={16} /></span>
                      <strong>{company.name}</strong>
                    </span>
                  </td>
                  <td>{company.trade}</td>
                  <td>{company.members}명</td>
                  <td><span className="admin-role-badge">{company.access}</span></td>
                  <td><span className="admin-status-badge">{company.status}</span></td>
                  <td><button className="table-icon" type="button" aria-label={`${company.name} 메뉴`}><MoreVertical size={17} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminSectionFrame>
    );
  }

  if (activeSection === "브리지") {
    return (
      <AdminSectionFrame
        activeSection={activeSection}
        kicker="Cross-project collaboration"
        description="프로젝트 브리지"
        action={<button className="primary-action" type="button"><Plus size={16} /><span>브리지 만들기</span></button>}
      >
        <div className="admin-metric-grid">
          <AdminMetricCard label="연결된 프로젝트" value="0" note="현재 활성 연결 없음" />
          <AdminMetricCard label="수신 자동화" value="0" note="수신 컨텐츠 없음" />
          <AdminMetricCard label="송신 자동화" value="0" note="송신 컨텐츠 없음" />
        </div>
        <div className="admin-empty-feature">
          <span className="admin-empty-icon" aria-hidden="true"><ArrowLeftRight size={28} /></span>
          <strong>아직 연결된 브리지가 없습니다</strong>
          <p>다른 프로젝트의 시트와 파일을 공유하면 중복 업로드 없이 최신 컨텐츠를 함께 사용할 수 있습니다.</p>
          <button className="secondary-action admin-bordered-action" type="button">브리지 설정 알아보기</button>
        </div>
      </AdminSectionFrame>
    );
  }

  if (activeSection === "액티비티") {
    const activities = [
      { title: "구성원 권한 확인", detail: "개혁 이 님이 도면 검토자의 역할을 확인했습니다.", time: "오늘 14:20" },
      { title: "프로젝트 설정 검토", detail: "프로젝트 기본 정보와 액세스 정책을 검토했습니다.", time: "오늘 11:05" },
      { title: "Build 기본 앱 확인", detail: "시트, 파일, 이슈 앱의 활성 상태를 확인했습니다.", time: "어제 16:42" }
    ];
    return (
      <AdminSectionFrame activeSection={activeSection} kicker="Audit trail" description="최근 Project Admin 활동">
        <div className="admin-section-toolbar">
          <label className="search-field">
            <Search size={17} aria-hidden="true" />
            <input aria-label="활동 검색" name="project-activity-search" placeholder="사용자 또는 활동 검색..." />
          </label>
          <button className="secondary-action admin-bordered-action" type="button"><Download size={16} />활동 내보내기</button>
        </div>
        <div className="admin-activity-list">
          {activities.map((activity, index) => (
            <article className="admin-activity-row" key={activity.title}>
              <span className="admin-activity-icon" aria-hidden="true">{index === 0 ? <Users size={17} /> : index === 1 ? <Settings size={17} /> : <HardHat size={17} />}</span>
              <div>
                <strong>{activity.title}</strong>
                <p>{activity.detail}</p>
              </div>
              <time>{activity.time}</time>
            </article>
          ))}
        </div>
      </AdminSectionFrame>
    );
  }

  if (activeSection === "알림") {
    const notifications = [
      { title: "구성원 변경", detail: "구성원 추가, 제거 또는 역할 변경 시 알림", enabled: true },
      { title: "시트 게시", detail: "새 시트 버전 또는 시트 세트가 게시될 때 알림", enabled: true },
      { title: "이슈 할당", detail: "나 또는 내 회사에 이슈가 할당될 때 알림", enabled: false }
    ];
    return (
      <AdminSectionFrame
        activeSection={activeSection}
        kicker="Communication preferences"
        description="프로젝트 알림 설정"
        action={<button className="primary-action" type="button"><Check size={16} /><span>알림 저장</span></button>}
      >
        <div className="admin-settings-intro">
          <Bell size={18} aria-hidden="true" />
          <span>프로젝트 수준 알림은 개인 알림 설정보다 우선하지 않습니다.</span>
        </div>
        <div className="admin-preference-list">
          {notifications.map((notification) => (
            <label className="admin-preference-row" key={notification.title}>
              <span>
                <strong>{notification.title}</strong>
                <small>{notification.detail}</small>
              </span>
              <input type="checkbox" defaultChecked={notification.enabled} aria-label={`${notification.title} 알림`} />
            </label>
          ))}
        </div>
        <div className="admin-form-row">
          <div>
            <strong>요약 메일</strong>
            <small>선택한 주기로 프로젝트 활동을 요약하여 발송합니다.</small>
          </div>
          <select aria-label="요약 메일 주기" defaultValue="매일">
            <option>즉시</option>
            <option>매일</option>
            <option>매주</option>
          </select>
        </div>
      </AdminSectionFrame>
    );
  }

  if (activeSection === "위치") {
    return (
      <AdminSectionFrame
        activeSection={activeSection}
        kicker="Project location"
        description="프로젝트 위치"
        action={<button className="primary-action" type="button"><Check size={16} /><span>위치 저장</span></button>}
      >
        <div className="admin-location-layout">
          <div className="admin-location-form">
            <label className="field">
              <span>주소</span>
              <input aria-label="프로젝트 주소" name="project-address" defaultValue="서울특별시 강서구 마곡중앙로 161-8" />
            </label>
            <div className="admin-form-columns">
              <label className="field">
                <span>도시</span>
                <input aria-label="도시" name="project-city" defaultValue="서울" />
              </label>
              <label className="field">
                <span>국가</span>
                <select aria-label="국가" defaultValue="대한민국"><option>대한민국</option></select>
              </label>
            </div>
            <label className="field">
              <span>시간대</span>
              <select aria-label="시간대" defaultValue="Asia/Seoul">
                <option value="Asia/Seoul">Asia/Seoul (UTC+09:00)</option>
              </select>
            </label>
          </div>
          <div className="admin-map-preview" role="img" aria-label="프로젝트 위치 미리보기">
            <span className="admin-map-grid" aria-hidden="true" />
            <span className="admin-map-pin" aria-hidden="true"><MapPin size={24} /></span>
            <div>
              <strong>Study_Project</strong>
              <span>서울특별시 강서구</span>
            </div>
          </div>
        </div>
      </AdminSectionFrame>
    );
  }

  return (
    <AdminSectionFrame
      activeSection={activeSection}
      kicker="Project configuration"
      description="Project 설정"
      action={<button className="primary-action" type="button"><Check size={16} /><span>변경사항 저장</span></button>}
    >
      <div className="admin-settings-groups">
        <section className="admin-settings-card">
          <div className="admin-settings-card-heading">
            <span className="admin-settings-card-icon" aria-hidden="true"><Pencil size={17} /></span>
            <div><strong>프로젝트 정보</strong><small>허브에 표시되는 프로젝트 기본 정보입니다.</small></div>
          </div>
          <div className="admin-form-columns">
            <label className="field"><span>프로젝트 이름</span><input aria-label="설정 프로젝트 이름" defaultValue="Study_Project" /></label>
            <label className="field"><span>프로젝트 번호</span><input aria-label="프로젝트 번호" placeholder="번호 없음" /></label>
          </div>
        </section>
        <section className="admin-settings-card">
          <div className="admin-settings-card-heading">
            <span className="admin-settings-card-icon" aria-hidden="true"><HardHat size={17} /></span>
            <div><strong>기본 앱</strong><small>프로젝트 구성원이 처음 진입할 작업 영역을 선택합니다.</small></div>
          </div>
          <label className="field"><span>시작 앱</span><select aria-label="프로젝트 시작 앱" defaultValue="Build"><option>Build</option><option>Project Admin</option></select></label>
        </section>
        <section className="admin-settings-card">
          <div className="admin-settings-card-heading">
            <span className="admin-settings-card-icon" aria-hidden="true"><Settings size={17} /></span>
            <div><strong>권한 정책</strong><small>새 구성원에게 적용되는 기본 액세스 수준입니다.</small></div>
          </div>
          <label className="field"><span>기본 역할</span><select aria-label="기본 역할" defaultValue="뷰어"><option>관리자</option><option>편집자</option><option>뷰어</option></select></label>
        </section>
      </div>
    </AdminSectionFrame>
  );
}

function AdminSectionFrame({
  activeSection,
  kicker,
  description,
  action,
  children
}: {
  activeSection: Exclude<AdminSection, "구성원">;
  kicker: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="admin-panel admin-section-shell" aria-labelledby={`project-admin-${activeSection}`}>
      <div className="admin-heading">
        <div>
          <span className="admin-page-kicker">{kicker}</span>
          <h1 id={`project-admin-${activeSection}`}>{activeSection}</h1>
          <p className="admin-section-lead">{description}</p>
        </div>
        {action}
      </div>
      <div className="admin-section-content">{children}</div>
    </section>
  );
}

function AdminMetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="admin-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function AdminSectionInspector({ activeSection }: { activeSection: Exclude<AdminSection, "구성원"> }) {
  const inspectorCopy = {
    회사: {
      kicker: "Project directory",
      title: "회사 요약",
      summary: "3개 회사",
      rows: [["활성 회사", "3"], ["전체 구성원", "24명"], ["제한된 액세스", "1개 회사"]]
    },
    브리지: {
      kicker: "Bridge status",
      title: "연결 상태",
      summary: "연결 대기",
      rows: [["수신 프로젝트", "0"], ["송신 프로젝트", "0"], ["공유 패키지", "0"]]
    },
    액티비티: {
      kicker: "Activity summary",
      title: "최근 기록",
      summary: "3개 활동",
      rows: [["오늘", "2개"], ["이번 주", "3개"], ["내보내기", "사용 가능"]]
    },
    알림: {
      kicker: "Notification status",
      title: "알림 요약",
      summary: "2개 활성",
      rows: [["구성원 변경", "켜짐"], ["시트 게시", "켜짐"], ["이슈 할당", "꺼짐"]]
    },
    위치: {
      kicker: "Location summary",
      title: "위치 정보",
      summary: "대한민국",
      rows: [["도시", "서울"], ["시간대", "UTC+09:00"], ["좌표", "주소 기준"]]
    },
    설정: {
      kicker: "Configuration",
      title: "설정 요약",
      summary: "Build",
      rows: [["프로젝트 상태", "활성"], ["시작 앱", "Build"], ["기본 역할", "뷰어"]]
    }
  } satisfies Record<Exclude<AdminSection, "구성원">, { kicker: string; title: string; summary: string; rows: string[][] }>;
  const detail = inspectorCopy[activeSection];
  const DetailIcon = adminSectionIcons[activeSection];

  return (
    <aside className="admin-inspector" role="complementary" aria-label={`${activeSection} 상세`}>
      <div className="admin-inspector-label">{detail.kicker}</div>
      <div className="admin-section-inspector-heading">
        <span aria-hidden="true"><DetailIcon size={19} /></span>
        <div>
          <h2>{detail.title}</h2>
          <strong>{detail.summary}</strong>
        </div>
      </div>
      <dl className="admin-inspector-meta">
        {detail.rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="admin-inspector-note">
        <Info size={15} aria-hidden="true" />
        <span>Project Admin 범위에서 관리되는 항목입니다.</span>
      </div>
    </aside>
  );
}

function MemberInspector({
  row,
  canManage,
  onRoleChange
}: {
  row: ProjectAccessRow | undefined;
  canManage: boolean;
  onRoleChange: (memberId: string, role: MemberRole) => void;
}) {
  if (!row) {
    return (
      <aside className="admin-inspector" role="complementary" aria-label="구성원 상세">
        <p>선택된 구성원이 없습니다.</p>
      </aside>
    );
  }

  return (
    <aside className="admin-inspector" role="complementary" aria-label="구성원 상세">
      <div className="admin-inspector-label">선택한 구성원</div>
      <div className="admin-inspector-profile">
        <div className="member-avatar" aria-hidden="true">
          {row.name.slice(0, 1)}
        </div>
        <div>
          <h2>{row.name}</h2>
          <span className="status-pill">{row.status}</span>
        </div>
      </div>
      <dl className="admin-inspector-meta">
        <div>
          <dt>이메일</dt>
          <dd><a href={`mailto:${row.email}`}>{row.email}</a></dd>
        </div>
        <div>
          <dt>전화</dt>
          <dd>{row.phone}</dd>
        </div>
        <div>
          <dt>추가된 일시</dt>
          <dd>{row.addedAt}</dd>
        </div>
      </dl>
      <div className="field select-field">
        <span>역할</span>
        <select
          aria-label="현재 역할"
          name="current-member-role"
          value={row.role}
          disabled={!canManage}
          title={canManage ? undefined : "역할 변경은 관리자만 가능합니다"}
          onChange={(e) => onRoleChange(row.memberId, e.target.value as MemberRole)}
        >
          {memberRoles.map((role) => (
            <option key={role}>{role}</option>
          ))}
        </select>
      </div>
    </aside>
  );
}

type AddMemberModalProps = {
  form: AddMemberForm;
  error: string;
  availableMembers: Member[];
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdate: (form: AddMemberForm) => void;
};

function AddMemberModal({ form, error, availableMembers, onClose, onSubmit, onUpdate }: AddMemberModalProps) {
  const dialogRef = useRef<HTMLFormElement>(null);
  useModalDismiss(onClose, dialogRef);
  return (
    <div className="modal-backdrop">
      <form
        ref={dialogRef}
        tabIndex={-1}
        className="project-modal member-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-member-title"
        onSubmit={onSubmit}
      >
        <header className="modal-header">
          <h2 id="add-member-title">구성원 추가</h2>
          <button className="modal-close" type="button" aria-label="닫기" onClick={onClose}>
            <X size={22} />
          </button>
        </header>
        <div className="modal-body">
          <label className="field select-field">
            <span>구성원</span>
            <select name="member-id" value={form.memberId} onChange={(event) => onUpdate({ ...form, memberId: event.target.value })}>
              <option value="">구성원 선택</option>
              {availableMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} / {member.email}
                </option>
              ))}
            </select>
          </label>
          <label className="field select-field">
            <span>역할</span>
            <select name="member-role" value={form.role} onChange={(event) => onUpdate({ ...form, role: event.target.value as ProjectMemberAccess["role"] })}>
              {memberRoles.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
          </label>
          {error ? <p className="field-error">{error}</p> : null}
        </div>
        <footer className="modal-footer">
          <button className="secondary-action" type="button" onClick={onClose}>
            취소
          </button>
          <button className="primary-action" type="submit">
            추가
          </button>
        </footer>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 템플릿 상세 모드(M2) — 일반 모드 컴포넌트와 완전 분리.
// ─────────────────────────────────────────────────────────────

type TemplateSectionKey = "구성" | "템플릿 구성원" | "프로젝트 구성원" | "회사" | "알림";

const templateRailGroups: {
  group: string;
  info?: boolean;
  items: { key: TemplateSectionKey; icon: LucideIcon }[];
}[] = [
  {
    group: "템플릿 설정",
    items: [
      { key: "구성", icon: Settings },
      { key: "템플릿 구성원", icon: Users }
    ]
  },
  {
    group: "프로젝트 설정",
    info: true,
    items: [
      { key: "프로젝트 구성원", icon: UserRound },
      { key: "회사", icon: Building2 },
      { key: "알림", icon: Bell }
    ]
  }
];

function TemplateAdminView({ templateName, onBackToProjects }: { templateName: string; onBackToProjects: () => void }) {
  const [activeSection, setActiveSection] = useState<TemplateSectionKey>("구성");
  const [published, setPublished] = useState(false);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [companyModalOpen, setCompanyModalOpen] = useState(false);

  return (
    <main className="admin-shell template-admin">
      <aside className="admin-rail" aria-label="템플릿 관리 메뉴">
        <div className="admin-product">
          <span className="admin-product-mark" aria-hidden="true">
            <Settings size={17} />
          </span>
          <span>Project Admin</span>
        </div>
        {templateRailGroups.map((group) => (
          <div className="admin-rail-group" key={group.group}>
            <p className="admin-rail-label">
              <span>{group.group}</span>
              {group.info ? <Info size={13} aria-hidden="true" /> : null}
            </p>
            {group.items.map(({ key, icon: Icon }) => (
              <button
                key={key}
                type="button"
                aria-current={key === activeSection ? "page" : undefined}
                onClick={() => setActiveSection(key)}
              >
                <Icon size={17} aria-hidden="true" />
                <span>{key}</span>
              </button>
            ))}
          </div>
        ))}
      </aside>

      <section className="admin-workspace">
        <header className="admin-topline">
          <div className="project-context-stack">
            <button className="ghost-action" type="button" onClick={onBackToProjects}>
              <ArrowLeft size={16} aria-hidden="true" />
              <span>프로젝트 템플릿</span>
            </button>
            <span className="level-kicker">프로젝트 템플릿</span>
            <strong>{templateName}</strong>
          </div>
          <span className="settings-scope-chip">템플릿 관리</span>
        </header>

        <section className="admin-main admin-template-main">
          {activeSection === "구성" ? (
            <TemplateConfigSection templateName={templateName} published={published} onTogglePublished={() => setPublished((value) => !value)} />
          ) : activeSection === "템플릿 구성원" ? (
            <TemplateMembersSection onAdd={() => setMemberModalOpen(true)} />
          ) : activeSection === "프로젝트 구성원" ? (
            <TemplateProjectMembersSection />
          ) : activeSection === "회사" ? (
            <TemplateCompaniesSection onAdd={() => setCompanyModalOpen(true)} />
          ) : (
            <TemplateNotificationsSection />
          )}
        </section>
      </section>

      {memberModalOpen ? <TemplateAddModal title="템플릿 구성원 추가" onClose={() => setMemberModalOpen(false)} /> : null}
      {companyModalOpen ? <TemplateAddModal title="회사 추가" onClose={() => setCompanyModalOpen(false)} /> : null}
    </main>
  );
}

function TemplateConfigSection({
  templateName,
  published,
  onTogglePublished
}: {
  templateName: string;
  published: boolean;
  onTogglePublished: () => void;
}) {
  return (
    <section className="admin-panel" aria-label="템플릿 구성">
      <div className="admin-heading">
        <h1>구성</h1>
      </div>

      <div className="template-action-bar">
        <button type="button" className="secondary-action">
          <Plus size={16} aria-hidden="true" />
          <span>프로젝트 만들기</span>
        </button>
        <button type="button" className="secondary-action">사본 작성</button>
        <button type="button" className="secondary-action">보관</button>
      </div>

      <div className="template-config-block">
        <h2>일반</h2>
        <div className="config-row">
          <div className="config-text">
            <span className="config-key">템플릿 이름</span>
            <strong>{templateName}</strong>
          </div>
          <button type="button" className="icon-button" aria-label="템플릿 이름 편집">
            <Pencil size={16} />
          </button>
        </div>
      </div>

      <div className="template-config-block">
        <h2>고급</h2>
        <div className="config-row">
          <div className="config-text">
            <span className="config-key">템플릿 게시</span>
            <p className="config-note">이 템플릿은 프로젝트를 작성할 수 있는 허브의 모든 구성원이 사용할 수 있습니다.</p>
          </div>
          <button
            type="button"
            className={`publish-toggle${published ? " is-on" : ""}`}
            role="switch"
            aria-checked={published}
            aria-label="템플릿 게시"
            onClick={onTogglePublished}
          >
            <span className="toggle-track" aria-hidden="true">
              <span className="toggle-thumb" />
            </span>
            <span className="toggle-label">{published ? "예" : "아니요"}</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function TemplateMembersSection({ onAdd }: { onAdd: () => void }) {
  return (
    <section className="admin-panel" aria-label="템플릿 구성원">
      <div className="admin-heading">
        <h1>템플릿 구성원</h1>
        <button type="button" className="primary-action" onClick={onAdd}>
          템플릿 구성원 추가
        </button>
      </div>
      <p className="admin-section-desc">이 템플릿을 관리할 수 있는 구성원입니다.</p>

      <div className="admin-tools">
        <label className="search-field admin-search">
          <Search size={18} aria-hidden="true" />
          <input aria-label="템플릿 구성원 검색" name="template-member-search" placeholder="이름 또는 이메일로 검색..." />
        </label>
      </div>

      <div className="table-scroll admin-table-scroll">
        <table className="project-table admin-member-table">
          <thead>
            <tr>
              <th scope="col">구성원</th>
              <th scope="col">이메일</th>
              <th scope="col">회사</th>
              <th scope="col">역할</th>
              <th scope="col">액세스 레벨</th>
            </tr>
          </thead>
          <tbody>
            {templateMembers.map((member) => (
              <tr key={member.id} data-testid="template-member-row">
                <td>{member.name}</td>
                <td>{member.email}</td>
                <td>{member.company}</td>
                <td>{member.role}</td>
                <td>{member.accessLevel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination" aria-label="페이지네이션">
        <span>{templateMembers.length}개 중 1~{templateMembers.length}개 표시 중</span>
        <div className="pager-buttons">
          <span>1/1</span>
        </div>
      </div>
    </section>
  );
}

function TemplateProjectMembersSection() {
  return (
    <section className="admin-panel" aria-label="프로젝트 구성원">
      <div className="admin-heading">
        <h1>프로젝트 구성원</h1>
        <button type="button" className="primary-action">프로젝트 구성원 추가</button>
      </div>
      <p className="admin-section-desc">이 템플릿에서 작성된 프로젝트에 포함될 구성원을 관리합니다.</p>

      <div className="admin-tools">
        <label className="search-field admin-search">
          <Search size={18} aria-hidden="true" />
          <input aria-label="프로젝트 구성원 검색" name="template-project-member-search" placeholder="이름 또는 이메일로 검색..." />
        </label>
      </div>

      <div className="table-scroll admin-table-scroll">
        <table className="project-table admin-member-table">
          <thead>
            <tr>
              <th scope="col">프로젝트 구성원</th>
              <th scope="col">이메일</th>
              <th scope="col">회사</th>
              <th scope="col">역할</th>
              <th scope="col">액세스 레벨</th>
            </tr>
          </thead>
          <tbody />
        </table>
        <div className="empty-state template-empty" role="status">
          <div className="empty-illustration" aria-hidden="true">
            <HardHat size={40} />
          </div>
          <strong>표시할 프로젝트 구성원이 없습니다.</strong>
        </div>
      </div>
    </section>
  );
}

function TemplateCompaniesSection({ onAdd }: { onAdd: () => void }) {
  return (
    <section className="admin-panel" aria-label="회사">
      <div className="admin-heading">
        <h1>회사</h1>
        <button type="button" className="primary-action" onClick={onAdd}>
          <span>회사 추가</span>
          <Info size={14} aria-hidden="true" />
        </button>
      </div>

      <div className="admin-tools">
        <label className="search-field admin-search">
          <Search size={18} aria-hidden="true" />
          <input aria-label="회사 검색" name="template-company-search" placeholder="이름으로 회사 검색..." />
        </label>
        <Info size={16} aria-hidden="true" />
      </div>

      <div className="table-scroll admin-table-scroll">
        <table className="project-table admin-member-table">
          <thead>
            <tr>
              <th scope="col">이름</th>
              <th scope="col">업종</th>
              <th scope="col">추가된 일시</th>
              <th scope="col" aria-label="작업" />
            </tr>
          </thead>
          <tbody>
            {templateCompanies.map((company) => (
              <tr key={company.id} data-testid="template-company-row">
                <td>{company.name}</td>
                <td>{company.industry}</td>
                <td>{company.addedAt}</td>
                <td>
                  <button type="button" className="icon-button" aria-label="회사 작업">
                    <MoreVertical size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TemplateNotificationsSection() {
  return (
    <section className="admin-panel template-notify" aria-label="알림">
      <div className="admin-heading">
        <h1>프로젝트 알림 설정</h1>
      </div>

      <div className="notify-layout">
        <nav className="notify-subnav" aria-label="알림 설정 메뉴">
          <button type="button" className="primary-action notify-create">
            <Plus size={16} aria-hidden="true" />
            <span>알림 그룹 작성</span>
          </button>
          <button type="button" className="notify-subnav-item is-active" aria-current="page">
            <Check size={15} aria-hidden="true" />
            <span>기본 알림 설정</span>
          </button>
          <button type="button" className="notify-subnav-item">
            <span>Opt out</span>
          </button>
        </nav>

        <div className="notify-matrix">
          <h2 className="notify-matrix-title">기본 알림 설정</h2>
          <NotificationMatrix />
        </div>
      </div>
    </section>
  );
}

function NotificationMatrix() {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [frequencies, setFrequencies] = useState<Record<string, string>>({});

  function toggleKey(setter: (updater: (prev: Set<string>) => Set<string>) => void, key: string) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function setFreq(key: string, value: string) {
    setFrequencies((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="notify-table" role="table" aria-label="프로젝트 알림 설정 매트릭스">
      <div className="notify-row notify-head" role="row">
        <span className="notify-col-tool">
          도구 및 알림 유형 <Info size={13} aria-hidden="true" />
        </span>
        <span className="notify-col-freq">
          주파수 <Info size={13} aria-hidden="true" />
        </span>
        <span className="notify-col-perm">
          <span className="visually-hidden">구성원 권한</span>
          <Users size={16} aria-hidden="true" />
        </span>
      </div>

      {notificationGroups.map((group) => {
        const groupExpanded = expandedGroups.has(group.id);
        const groupHasTools = group.tools.length > 0;
        return (
          <div className="notify-group-block" key={group.id}>
            <div className="notify-row notify-group" role="row">
              <span className="notify-col-tool">
                {groupHasTools ? (
                  <button
                    type="button"
                    className="notify-expander"
                    aria-expanded={groupExpanded}
                    aria-label={`${group.name} ${groupExpanded ? "접기" : "전개"}`}
                    onClick={() => toggleKey(setExpandedGroups, group.id)}
                  >
                    {groupExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                ) : (
                  <span className="notify-expander-spacer" aria-hidden="true" />
                )}
                <span className="notify-name">{group.name}</span>
                <Info size={13} aria-hidden="true" />
              </span>
              <FrequencyCell name={group.id} value={frequencies[group.id] ?? group.frequency} onChange={(value) => setFreq(group.id, value)} />
              <PermissionCell />
            </div>

            {groupExpanded && groupHasTools
              ? group.tools.map((tool) => {
                  const toolKey = `${group.id}/${tool.name}`;
                  const toolExpanded = expandedTools.has(toolKey);
                  const toolHasEvents = tool.events.length > 0;
                  return (
                    <div className="notify-tool-block" key={toolKey}>
                      <div className="notify-row notify-tool" role="row" data-testid="notify-tool-row">
                        <span className="notify-col-tool notify-indent-1">
                          {toolHasEvents ? (
                            <button
                              type="button"
                              className="notify-expander"
                              aria-expanded={toolExpanded}
                              aria-label={`${tool.name} ${toolExpanded ? "접기" : "전개"}`}
                              onClick={() => toggleKey(setExpandedTools, toolKey)}
                            >
                              {toolExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                            </button>
                          ) : (
                            <span className="notify-expander-spacer" aria-hidden="true" />
                          )}
                          <span className="notify-name">{tool.name}</span>
                        </span>
                        <FrequencyCell name={toolKey} value={frequencies[toolKey] ?? tool.frequency} onChange={(value) => setFreq(toolKey, value)} />
                        <PermissionCell />
                      </div>

                      {toolExpanded && toolHasEvents
                        ? tool.events.map((event, index) => {
                            const eventKey = `${toolKey}/${index}`;
                            return (
                              <div className="notify-row notify-event" role="row" key={eventKey}>
                                <span className="notify-col-tool notify-indent-2">
                                  <span className="notify-event-text">
                                    <strong>{event.label}</strong>
                                    <small>{event.description}</small>
                                  </span>
                                </span>
                                <FrequencyCell name={eventKey} value={frequencies[eventKey] ?? tool.frequency} onChange={(value) => setFreq(eventKey, value)} />
                                <PermissionCell />
                              </div>
                            );
                          })
                        : null}
                    </div>
                  );
                })
              : null}
          </div>
        );
      })}
    </div>
  );
}

function FrequencyCell({ name, value, onChange }: { name: string; value: string; onChange: (value: string) => void }) {
  return (
    <span className="notify-col-freq">
      <select
        className="notify-freq-select"
        name={`notify-frequency:${name}`}
        aria-label="주파수"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {notificationFrequencies.map((frequency) => (
          <option key={frequency} value={frequency}>
            {frequency}
          </option>
        ))}
      </select>
    </span>
  );
}

function PermissionCell() {
  return (
    <span className="notify-col-perm">
      <span className="perm-bar" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="perm-label">관리</span>
    </span>
  );
}

function TemplateAddModal({ title, onClose }: { title: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalDismiss(onClose, dialogRef);
  return (
    <div className="modal-backdrop">
      <div ref={dialogRef} tabIndex={-1} className="project-modal member-modal" role="dialog" aria-modal="true" aria-labelledby="template-add-title">
        <header className="modal-header">
          <h2 id="template-add-title">{title}</h2>
          <button className="modal-close" type="button" aria-label="닫기" onClick={onClose}>
            <X size={22} />
          </button>
        </header>
        <div className="modal-body">
          <label className="field">
            <span>이메일</span>
            <input name="template-add-email" placeholder="이메일 입력" />
          </label>
          <p className="field-note">로컬 셸 affordance — 실제 추가/영속화는 없습니다.</p>
        </div>
        <footer className="modal-footer">
          <button className="secondary-action" type="button" onClick={onClose}>
            취소
          </button>
          <button className="primary-action" type="button" onClick={onClose}>
            추가
          </button>
        </footer>
      </div>
    </div>
  );
}
