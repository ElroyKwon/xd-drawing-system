import {
  CalendarDays,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  CircleHelp,
  Filter,
  Hammer,
  ListFilter,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
  X
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import BuildSheetsView from "./BuildSheetsView";
import ProjectAdminView from "./ProjectAdminView";

type Project = {
  id: string;
  typeIcon: string;
  name: string;
  number: string;
  projectType: string;
  templateId: string;
  address: string;
  manualAddress: boolean;
  timezone: string;
  startDate: string;
  endDate: string;
  projectValue: string;
  currency: string;
  defaultAccess: string;
  hub: string;
  createdAt: string;
};

type ProjectForm = {
  name: string;
  number: string;
  projectType: string;
  templateId: string;
  address: string;
  manualAddress: boolean;
  timezone: string;
  startDate: string;
  endDate: string;
  projectValue: string;
  currency: string;
};

const initialProjects: Project[] = [
  {
    id: "project-study",
    typeIcon: "project",
    name: "Study_Project",
    number: "A-001",
    projectType: "지정되지 않음",
    templateId: "none",
    address: "",
    manualAddress: false,
    timezone: "서울",
    startDate: "",
    endDate: "",
    projectValue: "",
    currency: "USD",
    defaultAccess: "Build",
    hub: "TEST-",
    createdAt: "오늘 오전 10:24"
  },
  {
    id: "project-seaport",
    typeIcon: "project",
    name: "Construction : Sample Project - Seaport Civic Center",
    number: "C-204",
    projectType: "건설",
    templateId: "owner",
    address: "300 Mission Street",
    manualAddress: false,
    timezone: "서울",
    startDate: "",
    endDate: "",
    projectValue: "",
    currency: "USD",
    defaultAccess: "Build",
    hub: "TEST-",
    createdAt: "오늘 오전 10:20"
  }
];

const emptyForm: ProjectForm = {
  name: "",
  number: "",
  projectType: "지정되지 않음",
  templateId: "",
  address: "",
  manualAddress: false,
  timezone: "서울",
  startDate: "",
  endDate: "",
  projectValue: "",
  currency: "USD"
};

function formatCreatedAt() {
  return "방금 전";
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [query, setQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<ProjectForm>(emptyForm);
  const [nameError, setNameError] = useState(false);
  const [activeView, setActiveView] = useState<"projects" | "project-admin" | "build-sheets">("projects");

  const filteredProjects = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return projects;
    }

    return projects.filter((project) => {
      return (
        project.name.toLowerCase().includes(normalized) ||
        project.number.toLowerCase().includes(normalized)
      );
    });
  }, [projects, query]);

  function openModal() {
    setForm(emptyForm);
    setNameError(false);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setForm(emptyForm);
    setNameError(false);
  }

  function updateForm<K extends keyof ProjectForm>(key: K, value: ProjectForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "name" && typeof value === "string" && value.trim()) {
      setNameError(false);
    }
  }

  function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const projectName = form.name.trim();
    if (!projectName) {
      setNameError(true);
      return;
    }

    const createdProject: Project = {
      id: `project-${Date.now()}`,
      typeIcon: "project",
      name: projectName,
      number: form.number.trim(),
      projectType: form.projectType,
      templateId: form.templateId,
      address: form.address.trim(),
      manualAddress: form.manualAddress,
      timezone: form.timezone,
      startDate: form.startDate,
      endDate: form.endDate,
      projectValue: form.projectValue.trim(),
      currency: form.currency,
      defaultAccess: "Build",
      hub: "TEST-",
      createdAt: formatCreatedAt()
    };

    setProjects((current) => [createdProject, ...current]);
    closeModal();
  }

  const visibleCountLabel =
    filteredProjects.length === 0
      ? `${projects.length}개 중 0개 표시 중`
      : `${projects.length}개 중 1-${filteredProjects.length}개 표시 중`;

  if (activeView === "project-admin") {
    return <ProjectAdminView onBackToProjects={() => setActiveView("projects")} />;
  }

  if (activeView === "build-sheets") {
    return <BuildSheetsView onBackToProjects={() => setActiveView("projects")} />;
  }

  return (
    <main className="app-shell">
      <TopBar />

      <section className="workspace">
        <div className="hub-label">
          <span className="hub-icon" aria-hidden="true">
            <Settings size={17} />
          </span>
          <span>Hub Admin</span>
        </div>

        <div className="hero-row">
          <div>
            <h1>계획 님, 환영합니다.</h1>
            <p>오늘 무엇을 하시겠습니까?</p>
          </div>
          <div className="trial-chip">XD Drawing System</div>
        </div>

        <nav className="tabs" aria-label="허브 메뉴">
          <button type="button" role="tab" aria-selected="false">
            My Home
          </button>
          <button type="button" role="tab" aria-selected="true">
            프로젝트
          </button>
          <button type="button" role="tab" aria-selected="false">
            프로젝트 템플릿
          </button>
        </nav>

        <section className="project-panel" aria-labelledby="project-list-title">
          <div className="toolbar">
            <button className="primary-action" type="button" onClick={openModal}>
              <Plus size={17} />
              <span>프로젝트 만들기</span>
            </button>

            <div className="table-tools" aria-label="목록 도구">
              <label className="search-field">
                <Search size={18} aria-hidden="true" />
                <input
                  aria-label="프로젝트 검색"
                  name="project-search"
                  placeholder="이름 또는 번호로 프로젝트 검색..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <button className="icon-button" type="button" aria-label="필터">
                <Filter size={20} />
              </button>
            </div>
          </div>

          <div className="table-scroll" role="region" aria-labelledby="project-list-title" tabIndex={0}>
            <h2 id="project-list-title" className="visually-hidden">
              프로젝트 목록
            </h2>
            <table className="project-table">
              <thead>
                <tr>
                  <th scope="col">유형</th>
                  <th scope="col">이름</th>
                  <th scope="col">번호</th>
                  <th scope="col">기본 액세스</th>
                  <th scope="col">허브</th>
                  <th scope="col">작성 날짜</th>
                  <th scope="col" aria-label="정렬">
                    <ListFilter size={17} aria-hidden="true" />
                  </th>
                  <th scope="col" aria-label="설정">
                    <button className="table-icon" type="button" aria-label="컬럼 설정">
                      <Settings size={18} />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((project) => (
                  <tr key={project.id} data-testid="project-row">
                    <td>
                      <span className="type-mark" aria-label="프로젝트 유형">
                        <span className="type-slope" />
                      </span>
                    </td>
                    <td>
                      <div className="name-cell">
                        <span>{project.name}</span>
                        {project.address ? <small>{project.address}</small> : null}
                        {project.id === "project-study" ? (
                          <button
                            className="inline-link-action"
                            type="button"
                            aria-label={`${project.name} Project Admin 열기`}
                            onClick={() => setActiveView("project-admin")}
                          >
                            Project Admin
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td>{project.number || "-"}</td>
                    <td>
                      <button
                        className="access-button"
                        type="button"
                        aria-label={project.id === "project-study" ? `${project.name} Build 열기` : `${project.name} 기본 액세스`}
                        onClick={project.id === "project-study" ? () => setActiveView("build-sheets") : undefined}
                      >
                        <span className="access-icon">
                          <Hammer size={18} />
                        </span>
                        <span>{project.defaultAccess}</span>
                        <ChevronDown size={15} />
                      </button>
                    </td>
                    <td>{project.hub}</td>
                    <td>{project.createdAt}</td>
                    <td />
                    <td />
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredProjects.length === 0 ? (
              <div className="empty-state" role="status">
                검색 결과가 없습니다.
              </div>
            ) : null}
          </div>

          <div className="pagination" aria-label="페이지네이션">
            <span>{visibleCountLabel}</span>
            <div className="pager-buttons">
              <button type="button" aria-label="첫 페이지">
                <ChevronsLeft size={16} />
              </button>
              <button type="button" aria-label="이전 페이지">
                <ChevronDown className="rotate-90" size={16} />
              </button>
              <span>1/1</span>
              <button type="button" aria-label="다음 페이지">
                <ChevronDown className="rotate-minus-90" size={16} />
              </button>
              <button type="button" aria-label="마지막 페이지">
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        </section>
      </section>

      {isModalOpen ? (
        <ProjectCreateModal
          form={form}
          nameError={nameError}
          onClose={closeModal}
          onSubmit={submitProject}
          onUpdate={updateForm}
        />
      ) : null}
    </main>
  );
}

function TopBar() {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">XD</span>
        <span>Drawing System</span>
      </div>

      <div className="product-strip" aria-label="관련 제품">
        <span>더 많은 XD 제품</span>
        <span className="product-pill">xD-HUB</span>
        <span className="product-pill">xD-Works</span>
        <span className="product-pill">xD-ACS</span>
      </div>

      <div className="account-tools">
        <button type="button" className="round-button" aria-label="도움말">
          <CircleHelp size={18} />
        </button>
        <button type="button" className="avatar" aria-label="사용자 메뉴">
          개이
        </button>
      </div>
    </header>
  );
}

type ProjectCreateModalProps = {
  form: ProjectForm;
  nameError: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof ProjectForm>(key: K, value: ProjectForm[K]) => void;
};

function ProjectCreateModal({ form, nameError, onClose, onSubmit, onUpdate }: ProjectCreateModalProps) {
  return (
    <div className="modal-backdrop">
      <form className="project-modal" role="dialog" aria-modal="true" aria-labelledby="project-create-title" onSubmit={onSubmit}>
        <header className="modal-header">
          <h2 id="project-create-title">프로젝트 작성</h2>
          <button className="modal-close" type="button" aria-label="닫기" onClick={onClose}>
            <X size={22} />
          </button>
        </header>

        <div className="modal-body">
          <label className="field">
            <span>
              프로젝트 이름 <b aria-hidden="true">*</b>
            </span>
            <input
              value={form.name}
              onChange={(event) => onUpdate("name", event.target.value)}
              aria-invalid={nameError}
              aria-describedby={nameError ? "project-name-error" : undefined}
              autoFocus
            />
            {nameError ? (
              <span id="project-name-error" className="field-error">
                프로젝트 이름을 입력하세요.
              </span>
            ) : null}
          </label>

          <label className="field">
            <span>프로젝트 번호</span>
            <input
              placeholder="프로젝트 번호 입력"
              value={form.number}
              onChange={(event) => onUpdate("number", event.target.value)}
            />
          </label>

          <label className="field select-field">
            <span>프로젝트 유형</span>
            <select value={form.projectType} onChange={(event) => onUpdate("projectType", event.target.value)}>
              <option>지정되지 않음</option>
              <option>건설</option>
              <option>리노베이션</option>
              <option>운영관리</option>
            </select>
          </label>

          <label className="field select-field">
            <span>
              템플릿 <CircleHelp size={13} aria-hidden="true" />
            </span>
            <select value={form.templateId} onChange={(event) => onUpdate("templateId", event.target.value)}>
              <option value="">프로젝트 템플릿 선택</option>
              <option value="general">General Contractor</option>
              <option value="owner">Owner Operator</option>
              <option value="public">Public Service Owners</option>
            </select>
          </label>

          <label className="field address-field">
            <span>
              주소
              <button type="button" className="link-button" onClick={() => onUpdate("manualAddress", !form.manualAddress)}>
                주소를 수동으로 입력
              </button>
            </span>
            <input
              placeholder="위치 입력"
              value={form.address}
              onChange={(event) => onUpdate("address", event.target.value)}
            />
          </label>

          <label className="field select-field">
            <span>
              시간대 <CircleHelp size={13} aria-hidden="true" />
            </span>
            <select value={form.timezone} onChange={(event) => onUpdate("timezone", event.target.value)}>
              <option>서울</option>
              <option>UTC</option>
              <option>Los Angeles</option>
            </select>
          </label>

          <div className="field-grid">
            <label className="field date-field">
              <span>
                시작일 <CircleHelp size={13} aria-hidden="true" />
              </span>
              <span className="input-with-icon">
                <CalendarDays size={16} aria-hidden="true" />
                <input
                  placeholder="YYYY/MM/DD"
                  value={form.startDate}
                  onChange={(event) => onUpdate("startDate", event.target.value)}
                />
              </span>
            </label>

            <label className="field date-field">
              <span>
                종료일 <CircleHelp size={13} aria-hidden="true" />
              </span>
              <span className="input-with-icon">
                <CalendarDays size={16} aria-hidden="true" />
                <input
                  placeholder="YYYY/MM/DD"
                  value={form.endDate}
                  onChange={(event) => onUpdate("endDate", event.target.value)}
                />
              </span>
            </label>
          </div>

          <div className="field-grid">
            <label className="field">
              <span>프로젝트 값</span>
              <input
                placeholder="값 입력"
                inputMode="decimal"
                value={form.projectValue}
                onChange={(event) => onUpdate("projectValue", event.target.value)}
              />
            </label>

            <label className="field select-field">
              <span>통화</span>
              <select value={form.currency} onChange={(event) => onUpdate("currency", event.target.value)}>
                <option>USD</option>
                <option>KRW</option>
                <option>JPY</option>
              </select>
            </label>
          </div>
        </div>

        <footer className="modal-footer">
          <button className="secondary-action" type="button" onClick={onClose}>
            취소
          </button>
          <button className="primary-action" type="submit">
            프로젝트 작성
          </button>
        </footer>
      </form>
    </div>
  );
}
