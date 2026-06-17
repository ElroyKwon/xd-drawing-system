import { ArrowLeft, Download, Filter, Search, Settings, Users, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import {
  buildProjectAccessRows,
  initialMembers,
  initialProjectAccess,
  memberRoles,
  selectedProject,
  type ProjectAccessRow,
  type ProjectMemberAccess
} from "./projectAdminData";

type ProjectAdminViewProps = {
  onBackToProjects: () => void;
};

type AddMemberForm = {
  memberId: string;
  role: ProjectMemberAccess["role"];
};

const emptyAddMemberForm: AddMemberForm = {
  memberId: "",
  role: "뷰어"
};

export default function ProjectAdminView({ onBackToProjects }: ProjectAdminViewProps) {
  const [accessRecords] = useState<ProjectMemberAccess[]>(initialProjectAccess);
  const [query, setQuery] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("member-owner");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddMemberForm>(emptyAddMemberForm);
  const [addError, setAddError] = useState("");

  const accessRows = useMemo(() => {
    return buildProjectAccessRows(selectedProject.id, initialMembers, accessRecords);
  }, [accessRecords]);

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
    setAddError("구성원을 선택하세요.");
  }

  return (
    <main className="admin-shell">
      <aside className="admin-rail" aria-label="Project Admin 메뉴">
        <div className="admin-product">
          <Settings size={18} aria-hidden="true" />
          <span>Project Admin</span>
        </div>
        {["구성원", "회사", "브리지", "액티비티", "알림", "위치", "설정"].map((item) => (
          <button key={item} type="button" aria-current={item === "구성원" ? "page" : undefined}>
            <Users size={17} aria-hidden="true" />
            <span>{item}</span>
          </button>
        ))}
      </aside>

      <section className="admin-main">
        <header className="admin-topline">
          <button className="ghost-action" type="button" onClick={onBackToProjects}>
            <ArrowLeft size={16} aria-hidden="true" />
            <span>프로젝트 목록</span>
          </button>
          <strong>{selectedProject.name}</strong>
        </header>

        <section className="admin-panel" aria-labelledby="member-access-title">
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
      </section>

      <MemberInspector row={selectedRow} />

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
      <label className="field select-field">
        <span>역할</span>
        <select value={row.role} disabled>
          {memberRoles.map((role) => (
            <option key={role}>{role}</option>
          ))}
        </select>
      </label>
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
            <select value={form.memberId} onChange={(event) => onUpdate({ ...form, memberId: event.target.value })}>
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
            <select value={form.role} onChange={(event) => onUpdate({ ...form, role: event.target.value as ProjectMemberAccess["role"] })}>
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
