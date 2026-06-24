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
import { useMemo, useState, type FormEvent } from "react";
import {
  buildProjectAccessRows,
  initialMembers,
  initialProjectAccess,
  memberHasProjectAccess,
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
  accessRecords,
  onAccessRecordsChange,
  onBackToProjects
}: ProjectAdminViewProps) {
  const [localAccessRecords, setLocalAccessRecords] = useState<ProjectMemberAccess[]>(initialProjectAccess);
  const [query, setQuery] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("member-owner");
  const [activeSection, setActiveSection] = useState<AdminSection>("구성원");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddMemberForm>(emptyAddMemberForm);
  const [addError, setAddError] = useState("");
  const effectiveAccessRecords = accessRecords ?? localAccessRecords;

  function updateAccessRecords(updater: (records: ProjectMemberAccess[]) => ProjectMemberAccess[]) {
    const nextRecords = updater(effectiveAccessRecords);
    if (onAccessRecordsChange) {
      onAccessRecordsChange(nextRecords);
      return;
    }

    setLocalAccessRecords(nextRecords);
  }

  const accessRows = useMemo(() => {
    return buildProjectAccessRows(project.id, initialMembers, effectiveAccessRecords);
  }, [effectiveAccessRecords, project.id]);

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return accessRows;
    }

    return accessRows.filter((row) => {
      return row.name.toLowerCase().includes(normalized) || row.email.toLowerCase().includes(normalized);
    });
  }, [accessRows, query]);

  const selectedRow = accessRows.find((row) => row.memberId === selectedMemberId) ?? accessRows[0];

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

  function submitAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!addForm.memberId) {
      setAddError("구성원을 선택하세요.");
      return;
    }

    if (memberHasProjectAccess(project.id, addForm.memberId, effectiveAccessRecords)) {
      setAddError("이미 이 프로젝트에 추가된 구성원입니다.");
      return;
    }

    const nextAccess: ProjectMemberAccess = {
      projectId: project.id,
      memberId: addForm.memberId,
      role: addForm.role,
      status: "활성",
      addedAt: "방금 전"
    };

    updateAccessRecords((current) => [...current, nextAccess]);
    setSelectedMemberId(addForm.memberId);
    closeAddModal();
  }

  return (
    <main className="admin-shell">
      <aside className="admin-rail" aria-label="Project Admin 메뉴">
        <div className="admin-product">
          <Settings size={18} aria-hidden="true" />
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

      <section className="admin-main">
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

        {activeSection === "구성원" ? (
          <section className="admin-panel" aria-label="Project Admin 구성원 목록">
            <div className="admin-heading">
              <h1 id="member-access-title">구성원</h1>
              <button className="primary-action" type="button" onClick={openAddModal}>
                구성원 추가
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
                <thead>
                  <tr>
                    <th scope="col">이름</th>
                    <th scope="col">이메일</th>
                    <th scope="col">전화</th>
                    <th scope="col">상태</th>
                    <th scope="col">역할</th>
                    <th scope="col">추가된 일시</th>
                    <th scope="col" aria-label="설정">
                      <Settings size={18} />
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
                      <td>{row.name}</td>
                      <td>{row.email}</td>
                      <td>{row.phone}</td>
                      <td>{row.status}</td>
                      <td>{row.role}</td>
                      <td>{row.addedAt}</td>
                      <td />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <ProjectAdminSectionPanel activeSection={activeSection} />
        )}
      </section>

      {activeSection === "구성원" ? <MemberInspector row={selectedRow} /> : <AdminSectionInspector activeSection={activeSection} />}

      {isAddModalOpen ? (
        <AddMemberModal
          form={addForm}
          error={addError}
          onClose={closeAddModal}
          onSubmit={submitAddMember}
          onUpdate={setAddForm}
        />
      ) : null}
    </main>
  );
}

function ProjectAdminSectionPanel({ activeSection }: { activeSection: Exclude<AdminSection, "구성원"> }) {
  const sectionCopy: Record<Exclude<AdminSection, "구성원">, { lead: string; rows: string[] }> = {
    회사: {
      lead: "프로젝트 회사 관리",
      rows: ["Delta Engineers", "Crystal Clear Glazing", "Forma Sample Contractor"]
    },
    브리지: {
      lead: "프로젝트 브리지",
      rows: ["수신 컨텐츠 없음", "송신 컨텐츠 없음", "공유 패키지 대기"]
    },
    액티비티: {
      lead: "최근 Project Admin 활동",
      rows: ["구성원 권한 확인", "프로젝트 설정 검토", "Build 기본 앱 확인"]
    },
    알림: {
      lead: "프로젝트 알림 설정",
      rows: ["구성원 변경", "시트 게시", "이슈 할당"]
    },
    위치: {
      lead: "프로젝트 위치",
      rows: ["주소 미지정", "시간대: 서울", "위치 계층 결정 보류"]
    },
    설정: {
      lead: "Project 설정",
      rows: ["프로젝트 이름", "기본 앱", "권한 정책"]
    }
  };
  const copy = sectionCopy[activeSection];

  return (
    <section className="admin-panel admin-section-shell" aria-labelledby={`project-admin-${activeSection}`}>
      <div className="admin-heading">
        <h1 id={`project-admin-${activeSection}`}>{activeSection}</h1>
      </div>
      <p>{copy.lead}</p>
      <div className="section-list">
        {copy.rows.map((row) => (
          <div className="section-list-row" key={row}>
            <span>{row}</span>
            <strong>로컬 shell</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function AdminSectionInspector({ activeSection }: { activeSection: Exclude<AdminSection, "구성원"> }) {
  return (
    <aside className="admin-inspector" role="complementary" aria-label={`${activeSection} 상세`}>
      <h2>{activeSection} 상세</h2>
      <p>Project Admin 범위의 {activeSection} 화면입니다.</p>
      <span className="status-pill">Project 레벨</span>
    </aside>
  );
}

function MemberInspector({ row }: { row: ProjectAccessRow | undefined }) {
  if (!row) {
    return (
      <aside className="admin-inspector" role="complementary" aria-label="구성원 상세">
        <p>선택된 구성원이 없습니다.</p>
      </aside>
    );
  }

  return (
    <aside className="admin-inspector" role="complementary" aria-label="구성원 상세">
      <div className="member-avatar" aria-hidden="true">
        {row.name.slice(0, 1)}
      </div>
      <h2>{row.name}</h2>
      <a href={`mailto:${row.email}`}>{row.email}</a>
      <p>{row.phone}</p>
      <span className="status-pill">{row.status}</span>
      <div className="field select-field">
        <span>역할</span>
        <select aria-label="현재 역할" name="current-member-role" value={row.role} disabled>
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
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdate: (form: AddMemberForm) => void;
};

function AddMemberModal({ form, error, onClose, onSubmit, onUpdate }: AddMemberModalProps) {
  return (
    <div className="modal-backdrop">
      <form
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
              {initialMembers.map((member) => (
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
          <Settings size={18} aria-hidden="true" />
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

      <section className="admin-main">
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
  return (
    <div className="modal-backdrop">
      <div className="project-modal member-modal" role="dialog" aria-modal="true" aria-labelledby="template-add-title">
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
