import { ArrowLeft, Download, Filter, Search, Settings, Users, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import {
  buildProjectAccessRows,
  initialMembers,
  initialProjectAccess,
  memberHasProjectAccess,
  memberRoles,
  selectedProject,
  type ProjectAccessRow,
  type ProjectMemberAccess
} from "./projectAdminData";

type ProjectAdminProject = {
  id: string;
  name: string;
};

type ProjectAdminViewProps = {
  onBackToProjects: () => void;
  project?: ProjectAdminProject;
  accessRecords?: ProjectMemberAccess[];
  onAccessRecordsChange?: (records: ProjectMemberAccess[]) => void;
};

type AddMemberForm = {
  memberId: string;
  role: ProjectMemberAccess["role"];
};

const adminSections = ["구성원", "회사", "브리지", "액티비티", "알림", "위치", "설정"] as const;

type AdminSection = (typeof adminSections)[number];

const emptyAddMemberForm: AddMemberForm = {
  memberId: "",
  role: "뷰어"
};

export default function ProjectAdminView({
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
        {adminSections.map((item) => (
          <button
            key={item}
            type="button"
            aria-current={item === activeSection ? "page" : undefined}
            onClick={() => setActiveSection(item)}
          >
            <Users size={17} aria-hidden="true" />
            <span>{item}</span>
          </button>
        ))}
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
