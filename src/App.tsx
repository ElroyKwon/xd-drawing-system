import {
  Bookmark,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  CircleHelp,
  FileText,
  Filter,
  Hammer,
  LayoutTemplate,
  ListFilter,
  MapPin,
  Network,
  Pencil,
  Plus,
  FolderKanban,
  Search,
  Settings,
  Trash2,
  X
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import BuildSheetsView from "./BuildSheetsView";
import KnowledgeGraphView from "./KnowledgeGraphView";
import ProjectAdminView from "./ProjectAdminView";
import { useModalDismiss } from "./hooks/useModalDismiss";
import { initialProjectAccess, type ProjectMemberAccess } from "./projectAdminData";
import { createProject as apiCreateProject, deleteProject as apiDeleteProject, getMe, listMembers, listProjects, switchUser, type Me, type Member } from "./api/admin";
import { createTemplate as apiCreateTemplate, deleteTemplate as apiDeleteTemplate, listTemplates } from "./api/templates";

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

type HubTemplate = {
  id: string;
  name: string;
};

const initialProjects: Project[] = [
  {
    id: "project-study",
    typeIcon: "project",
    name: "Study_Project",
    number: "",
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
    createdAt: "2026년 6월 12일"
  },
  {
    id: "project-seaport",
    typeIcon: "project",
    name: "Construction : Sample Project - Seaport Civic Center",
    number: "",
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
    createdAt: "2026년 6월 12일"
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

type RecentItem = {
  id: string;
  name: string;
  openedAt: string;
  projectName: string;
  hub: string;
};

const recentItems: RecentItem[] = [
  { id: "r-a102", name: "A102", openedAt: "2026년 6월 12일 오전 11:40", projectName: "Construction : Sample Project", hub: "TEST-" },
  { id: "r-m101", name: "M101", openedAt: "2026년 6월 12일 오전 11:36", projectName: "Construction : Sample Project", hub: "TEST-" },
  { id: "r-a101", name: "A101", openedAt: "2026년 6월 12일 오전 11:36", projectName: "Construction : Sample Project", hub: "TEST-" },
  { id: "r-a103", name: "A103", openedAt: "2026년 6월 12일 오전 11:35", projectName: "Construction : Sample Project", hub: "TEST-" },
  { id: "r-a001", name: "A001", openedAt: "2026년 6월 12일 오전 11:35", projectName: "Construction : Sample Project", hub: "TEST-" }
];

const sampleTemplates = [
  { name: "General Contractor", access: "일반 액세스" },
  { name: "Public Service Owners", access: "소유자" },
  { name: "Investment Owners", access: "소유자" },
  { name: "Owner Operator", access: "소유자" }
];

// 템플릿 상세(M2) 진입점 시드 — 허브 템플릿 행이 기본 렌더되어 행 클릭으로 상세에 진입할 수 있어야 한다.
const seedHubTemplates: HubTemplate[] = [{ id: "template-standard", name: "표준 프로젝트 템플릿" }];

function formatCreatedAt() {
  return "방금 전";
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [projectAccessRecords, setProjectAccessRecords] = useState<ProjectMemberAccess[]>(initialProjectAccess);
  const [hubTemplates, setHubTemplates] = useState<HubTemplate[]>(seedHubTemplates);
  const [query, setQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<ProjectForm>(emptyForm);
  const [nameError, setNameError] = useState(false);
  const [activeView, setActiveView] = useState<
    "my-home" | "projects" | "project-templates" | "project-admin" | "template-admin" | "build-sheets" | "knowledge-graph"
  >("my-home");
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjects[0].id);
  const [selectedTemplateId, setSelectedTemplateId] = useState(seedHubTemplates[0].id);
  // S7: 로컬 모의 현재 사용자 + 백엔드 영속 프로젝트/구성원.
  const [me, setMe] = useState<Me | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    let alive = true;
    getMe().then((m) => alive && setMe(m)).catch(() => {});
    listMembers().then((m) => alive && setMembers(m)).catch(() => {});
    listProjects<Project>().then((rows) => {
      if (alive && rows.length) setProjects(rows);
    }).catch(() => {/* 백엔드 미가동 시 시드 유지 */});
    // S9.3: 허브 템플릿을 백엔드에서 로드(미가동 시 로컬 시드 유지).
    listTemplates().then((rows) => {
      if (alive && rows.length) setHubTemplates(rows.map((t) => ({ id: t.template_id, name: t.name })));
    }).catch(() => {/* 백엔드 미가동 시 시드 유지 */});
    return () => { alive = false; };
  }, []);

  async function handleSwitchUser(memberId: string) {
    try {
      setMe(await switchUser(memberId));
    } catch {/* 무시 */}
  }

  const selectedTemplate = hubTemplates.find((template) => template.id === selectedTemplateId) ?? hubTemplates[0];

  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0];
  // S7: 현재 사용자의 선택 프로젝트 역할(권한 UI 게이트용).
  const currentRole = me?.roles?.[selectedProject?.name ?? ""] ?? null;

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

  function openModalWithTemplate(templateName: string) {
    setForm({ ...emptyForm, templateId: templateName });
    setNameError(false);
    setIsModalOpen(true);
  }

  function updateForm<K extends keyof ProjectForm>(key: K, value: ProjectForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "name" && typeof value === "string" && value.trim()) {
      setNameError(false);
    }
  }

  async function submitProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const projectName = form.name.trim();
    if (!projectName) {
      setNameError(true);
      return;
    }

    const projectId = `project-${Date.now()}`;
    const createdProject: Project = {
      id: projectId,
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

    // 낙관적 반영(즉시 표시) + 백엔드 영속(생성자=관리자 자동). 새로고침 복원은 mount 로드가 담당.
    setProjects((current) => [createdProject, ...current]);
    setSelectedProjectId(projectId);
    closeModal();
    setActiveView("project-admin");
    // e2e 적발: 생성 후 me.roles를 갱신하지 않으면 새 프로젝트의 '생성자=관리자'가 currentRole에
    // 반영되지 않아(마운트 1회 로드 stale) canManage=false로 잠긴다 → 생성 성공 시 me 재로드.
    apiCreateProject<Project>(createdProject)
      .then(() => getMe().then(setMe))
      .catch(() => {/* 백엔드 미가동 폴백 — 로컬 유지 */});
  }

  function openProject(projectId: string) {
    setSelectedProjectId(projectId);
    setActiveView("project-admin");
  }

  function openBuild(projectId: string) {
    setSelectedProjectId(projectId);
    setActiveView("build-sheets");
  }

  async function handleDeleteProject(project: Project) {
    if (!window.confirm(`'${project.name}' 프로젝트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;
    try {
      await apiDeleteProject(project.id);
      setProjects((current) => current.filter((p) => p.id !== project.id));
      if (selectedProjectId === project.id) {
        setSelectedProjectId((current) => (current === project.id ? initialProjects[0].id : current));
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "프로젝트 삭제 실패");
    }
  }

  function addHubTemplate(name: string, kind: "blank" | "existing" = "blank", sourceProject?: string) {
    const localId = `template-${Date.now()}`;
    // 낙관적 반영(즉시 표시). 백엔드 영속은 뒤따르고, 성공 시 서버 id로 교체.
    setHubTemplates((current) => [...current, { id: localId, name }]);
    apiCreateTemplate({ name, source: kind, source_project: sourceProject ?? null })
      .then((created) =>
        setHubTemplates((current) => current.map((t) => (t.id === localId ? { id: created.template_id, name: created.name } : t)))
      )
      .catch(() => {/* 백엔드 미가동 폴백 — 로컬 유지 */});
  }

  function handleDeleteTemplate(templateId: string, name: string) {
    if (!window.confirm(`'${name}' 템플릿을 삭제하시겠습니까?`)) return;
    setHubTemplates((current) => current.filter((t) => t.id !== templateId));
    apiDeleteTemplate(templateId).catch(() => {/* 백엔드 미가동 폴백 */});
  }

  function openTemplateAdmin(templateId: string) {
    setSelectedTemplateId(templateId);
    setActiveView("template-admin");
  }

  const visibleCountLabel =
    filteredProjects.length === 0
      ? `${projects.length}개 중 0개 표시 중`
      : `${projects.length}개 중 1-${filteredProjects.length}개 표시 중`;

  if (activeView === "project-admin") {
    return (
      <ProjectAdminView
        project={selectedProject}
        accessRecords={projectAccessRecords}
        onAccessRecordsChange={setProjectAccessRecords}
        canManage={currentRole === "관리자"}
        onBackToProjects={() => setActiveView("projects")}
      />
    );
  }

  if (activeView === "template-admin") {
    return (
      <ProjectAdminView
        mode="template"
        templateName={selectedTemplate?.name ?? "프로젝트 템플릿"}
        onBackToProjects={() => setActiveView("project-templates")}
      />
    );
  }

  if (activeView === "build-sheets") {
    // J7: 뷰어는 콘텐츠 mutation 불가(서버 403과 일관). 미구성 프로젝트(role=null)는 레거시 보존 → 편집 허용.
    return (
      <BuildSheetsView
        project={selectedProject}
        canEdit={currentRole !== "뷰어"}
        onBackToProjects={() => setActiveView("projects")}
      />
    );
  }

  const hubViewTitle =
    activeView === "my-home"
      ? "My Home"
      : activeView === "project-templates"
        ? "프로젝트 템플릿"
        : activeView === "knowledge-graph"
          ? "메타그래프"
          : "프로젝트";

  const hubViewDescription =
    activeView === "my-home"
      ? "오늘 진행 중인 업무와 최근 활동을 확인합니다."
      : activeView === "project-templates"
        ? "반복 가능한 프로젝트 구성을 표준화합니다."
        : activeView === "knowledge-graph"
          ? "프로젝트 정보와 도면 지식의 연결 관계를 탐색합니다."
          : "허브에 등록된 프로젝트와 접근 정보를 관리합니다.";

  return (
    <main className="app-shell hub-shell">
      <HubSidebar activeView={activeView} onChange={setActiveView} />

      <div className="hub-main">
        <BrandBar title={hubViewTitle} me={me} members={members} onSwitch={handleSwitchUser} />

        <section className="workspace hub-workspace">

        <div className="hero-row">
          <div>
            <span className="page-kicker">Hub Admin</span>
            <h1>{hubViewTitle}</h1>
            <p>{hubViewDescription}</p>
          </div>
        </div>

        {activeView === "my-home" ? (
          <MyHomeView onOpenProject={openProject} />
        ) : activeView === "project-templates" ? (
          <ProjectTemplatesView
            hubTemplates={hubTemplates}
            projects={projects}
            onCreateTemplate={addHubTemplate}
            onUseTemplate={openModalWithTemplate}
            onOpenTemplate={openTemplateAdmin}
            onDeleteTemplate={handleDeleteTemplate}
          />
        ) : activeView === "knowledge-graph" ? (
          <KnowledgeGraphView
            projectName={selectedProject.name}
            onBack={() => setActiveView("projects")}
          />
        ) : (
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
                          <Hammer size={16} aria-hidden="true" />
                        </span>
                      </td>
                      <td>
                        <div className="name-cell">
                          <button
                            className="project-name-button"
                            type="button"
                            aria-label={`${project.name} 프로젝트 열기`}
                            onClick={() => openProject(project.id)}
                          >
                            {project.name}
                          </button>
                          {project.address ? <small>{project.address}</small> : null}
                        </div>
                      </td>
                      <td>{project.number || ""}</td>
                      <td>
                        <button
                          className="access-button"
                          type="button"
                          aria-label={`${project.name} Build 열기`}
                          onClick={() => openBuild(project.id)}
                        >
                          <span className="access-icon">
                            <Hammer size={16} />
                          </span>
                          <span>{project.defaultAccess}</span>
                          <ChevronDown size={15} />
                        </button>
                      </td>
                      <td>{project.hub}</td>
                      <td>{project.createdAt}</td>
                      <td />
                      <td>
                        {me?.roles?.[project.name] === "관리자" ? (
                          <button
                            className="table-icon danger"
                            type="button"
                            aria-label={`${project.name} 프로젝트 삭제`}
                            onClick={() => handleDeleteProject(project)}
                          >
                            <Trash2 size={17} aria-hidden="true" />
                          </button>
                        ) : null}
                      </td>
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
        )}
        </section>
      </div>

      {isModalOpen ? (
        <ProjectCreateModal
          form={form}
          nameError={nameError}
          hubTemplates={hubTemplates}
          onClose={closeModal}
          onSubmit={submitProject}
          onUpdate={updateForm}
        />
      ) : null}
    </main>
  );
}

function BrandBar({ title, me, members, onSwitch }: { title: string; me: Me | null; members: Member[]; onSwitch: (memberId: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  const name = me?.member?.name ?? "사용자";
  return (
    <header className="brand-bar">
      <div className="hub-breadcrumb" aria-label="현재 위치">
        <span>홈</span>
        <span aria-hidden="true">/</span>
        <strong>{title}</strong>
      </div>

      <div className="brand-tools">
        <button type="button" className="round-button" aria-label="도움말">
          <CircleHelp size={18} />
        </button>
        <div className="user-switch" ref={ref}>
          <button type="button" className="avatar" aria-label="사용자 메뉴" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((v) => !v)}>
            {name}
            <ChevronDown className={`account-caret${open ? " is-open" : ""}`} size={14} aria-hidden="true" />
          </button>
          {open ? (
            <div className="user-switch-menu" role="menu" aria-label="담당자 선택">
              <div className="user-switch-head">
                <strong>담당자 선택</strong>
                <span>확인할 사용자 계정을 선택하세요.</span>
              </div>
              <div className="user-switch-options">
                {members.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={me?.member_id === m.id}
                    className={me?.member_id === m.id ? "is-current" : ""}
                    onClick={() => { onSwitch(m.id); setOpen(false); }}
                  >
                    <span className="user-option-avatar" aria-hidden="true">{m.name.trim().slice(0, 1)}</span>
                    <span className="user-option-copy">
                      <strong>{m.name}</strong>
                      <span>{m.email}</span>
                    </span>
                    {me?.member_id === m.id ? <Check className="user-option-check" size={16} aria-hidden="true" /> : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

type HubNavigationView = "my-home" | "projects" | "project-templates" | "knowledge-graph";

function HubSidebar({ activeView, onChange }: { activeView: string; onChange: (view: HubNavigationView) => void }) {
  const items = [
    { id: "projects", label: "프로젝트", icon: FolderKanban },
    { id: "project-templates", label: "프로젝트 템플릿", icon: LayoutTemplate },
    { id: "knowledge-graph", label: "메타그래프", icon: Network }
  ] as const;

  return (
    <aside className="hub-sidebar" aria-label="Hub Admin 사이드바">
      <button
        type="button"
        className="hub-sidebar-brand"
        aria-label="Drawing System 대시보드로 이동"
        onClick={() => onChange("my-home")}
      >
        <img src="/ls-sauter-logo.png" alt="LS사우타" className="hub-brand-logo" />
        <span className="hub-brand-product-lockup">
          <span className="hub-brand-xd" aria-hidden="true">XD</span>
          <span className="hub-brand-system">Drawing System</span>
        </span>
      </button>

      <div className="hub-sidebar-section-label">Hub Admin</div>
      <nav className="hub-side-nav" aria-label="허브 메뉴">
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeView === id}
            onClick={() => onChange(id)}
          >
            <Icon size={17} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="hub-sidebar-footer">
        <Settings size={16} aria-hidden="true" />
        <span>시스템 관리</span>
      </div>
    </aside>
  );
}

type MyHomeViewProps = {
  onOpenProject: (projectId: string) => void;
};

function MyHomeView({ onOpenProject }: MyHomeViewProps) {
  const [showTour, setShowTour] = useState(true);

  return (
    <section className="my-home" aria-label="My Home">
      {showTour ? (
        <div className="tour-banner" role="note">
          <div className="tour-text">
            <strong>Take the tour to explore My Home</strong>
            <p>새로운 개인화 대시보드에서 모든 XD 프로젝트를 한 곳에서 살펴보세요.</p>
            <div className="tour-actions">
              <button type="button" className="tour-primary">
                Take the tour
              </button>
              <button type="button" className="link-button">
                Learn more
              </button>
            </div>
          </div>
          <button type="button" className="tour-close" aria-label="배너 닫기" onClick={() => setShowTour(false)}>
            <X size={18} />
          </button>
        </div>
      ) : null}

      <div className="my-home-toolbar">
        <button type="button" className="customize-link">
          <Pencil size={14} />
          <span>사용자화</span>
        </button>
      </div>

      <div className="my-home-grid">
        <section className="home-widget" aria-labelledby="assigned-title">
          <header className="widget-head">
            <h3 id="assigned-title">나에게 할당됨</h3>
          </header>
          <div className="assign-chips" role="group" aria-label="할당 필터">
            <button type="button" className="assign-chip is-active">나에게 할당됨</button>
            <button type="button" className="assign-chip">내 회사에 할당됨</button>
            <button type="button" className="assign-chip">내 액션에 지정됨</button>
          </div>
          <div className="widget-empty">
            <div className="empty-illustration" aria-hidden="true">
              <FileText size={34} />
            </div>
            <strong>No assignments found</strong>
            <p>나에게 항목이 할당되면 여기에 표시됩니다. 필터를 적용했다면 지워 보세요.</p>
            <button type="button" className="link-button">필터 지우기</button>
          </div>
        </section>

        <section className="home-widget" aria-labelledby="my-projects-title">
          <header className="widget-head">
            <h3 id="my-projects-title">내 프로젝트</h3>
          </header>
          <div className="map-placeholder" role="img" aria-label="내 프로젝트 위치 지도">
            <span className="map-pin">
              <MapPin size={26} />
            </span>
          </div>
        </section>

        <section className="home-widget" aria-labelledby="bookmarks-title">
          <header className="widget-head">
            <h3 id="bookmarks-title">책갈피</h3>
            <button type="button" className="widget-head-action" aria-label="책갈피 편집">
              <Pencil size={14} />
            </button>
          </header>
          <div className="widget-empty">
            <div className="empty-illustration" aria-hidden="true">
              <Bookmark size={32} />
            </div>
            <strong>아직 북마크가 없습니다</strong>
            <button type="button" className="link-button">북마크 추가하기</button>
            <p>사용하여 북마크를 추가하면 이 사이트의 빠른 액세스에 표시됩니다.</p>
          </div>
        </section>

        <section className="home-widget" aria-labelledby="recent-items-title">
          <header className="widget-head">
            <h3 id="recent-items-title">최근에 본 항목</h3>
          </header>
          <div className="recent-scroll">
            <table className="recent-table">
              <thead>
                <tr>
                  <th scope="col">이름</th>
                  <th scope="col">마지막으로 연 날짜</th>
                  <th scope="col">프로젝트 이름</th>
                  <th scope="col">허브 이름</th>
                </tr>
              </thead>
              <tbody>
                {recentItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <button
                        type="button"
                        className="recent-name"
                        aria-label={`${item.name} 열기`}
                        onClick={() => onOpenProject("project-study")}
                      >
                        <FileText size={15} aria-hidden="true" />
                        {item.name}
                      </button>
                    </td>
                    <td>{item.openedAt}</td>
                    <td>{item.projectName}</td>
                    <td>{item.hub}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="recent-footer">
            <span>{recentItems.length}개 중 1~{recentItems.length}개 표시 중</span>
            <span className="recent-pager">1/1</span>
          </div>
        </section>
      </div>
    </section>
  );
}

type ProjectTemplatesViewProps = {
  hubTemplates: HubTemplate[];
  projects: Project[];
  onCreateTemplate: (name: string, kind: "blank" | "existing", sourceProject?: string) => void;
  onUseTemplate: (templateName: string) => void;
  onOpenTemplate: (templateId: string) => void;
  onDeleteTemplate: (templateId: string, name: string) => void;
};

function ProjectTemplatesView({ hubTemplates, projects, onCreateTemplate, onUseTemplate, onOpenTemplate, onDeleteTemplate }: ProjectTemplatesViewProps) {
  const [flowStep, setFlowStep] = useState<"none" | "type" | "name">("none");
  const [templateKind, setTemplateKind] = useState<"blank" | "existing">("blank");
  const [templateName, setTemplateName] = useState("");
  const [sourceProject, setSourceProject] = useState("");
  const [sampleOpen, setSampleOpen] = useState(true);
  const typeModalRef = useRef<HTMLDivElement>(null);
  const nameModalRef = useRef<HTMLFormElement>(null);
  useModalDismiss(() => setFlowStep("none"), typeModalRef, flowStep === "type");
  useModalDismiss(() => setFlowStep("none"), nameModalRef, flowStep === "name");

  function startFlow() {
    setTemplateKind("blank");
    setTemplateName("");
    setSourceProject(projects[0]?.name ?? "");
    setFlowStep("type");
  }

  function submitTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = templateName.trim();
    if (!name) {
      return;
    }
    onCreateTemplate(name, templateKind, templateKind === "existing" ? sourceProject : undefined);
    setFlowStep("none");
  }

  return (
    <section className="templates-panel" aria-label="프로젝트 템플릿">
      <section className="tmpl-section" aria-labelledby="sample-template-title">
        <h3 id="sample-template-title" className="tmpl-section-heading">
          <button
            type="button"
            className="tmpl-section-head"
            aria-expanded={sampleOpen}
            onClick={() => setSampleOpen((open) => !open)}
          >
            <ChevronDown size={18} className={sampleOpen ? undefined : "rotate-minus-90"} />
            <span>샘플 템플릿</span>
          </button>
        </h3>
        {sampleOpen ? (
          <>
            <div className="tmpl-cards">
              {sampleTemplates.map((template) => (
                <article className="tmpl-card" key={template.name}>
                  <strong>{template.name}</strong>
                  <span className="tmpl-card-sub">사용자 정의</span>
                  <div className="tmpl-card-chips">
                    <span className="tmpl-chip">{template.access}</span>
                    <span className="tmpl-chip">복사</span>
                  </div>
                  <button type="button" className="tmpl-card-use" onClick={() => onUseTemplate(template.name)}>
                    사용하여 생성
                  </button>
                </article>
              ))}
            </div>
            <button type="button" className="tmpl-viewall">
              <ListFilter size={15} />
              모두 보기
            </button>
          </>
        ) : null}
      </section>

      <section className="tmpl-section" aria-labelledby="hub-template-title">
        <h3 id="hub-template-title" className="tmpl-section-title">허브 템플릿</h3>

        <div className="toolbar">
          <button type="button" className="primary-action" onClick={startFlow}>
            <Plus size={17} />
            <span>프로젝트 템플릿 작성</span>
          </button>
          <div className="table-tools">
            <label className="search-field">
              <Search size={18} aria-hidden="true" />
              <input aria-label="템플릿 검색" name="template-search" placeholder="이름으로 템플릿 검색..." />
            </label>
            <button className="icon-button" type="button" aria-label="필터">
              <Filter size={20} />
            </button>
          </div>
        </div>

        {hubTemplates.length === 0 ? (
          <div className="tmpl-empty">
            <div className="empty-illustration" aria-hidden="true">
              <FileText size={40} />
            </div>
            <strong>프로젝트 템플릿 구성원이 아니십니까?</strong>
            <p>
              허브 관리자에게 문의하여 템플릿에 액세스하거나 직접 작성한 프로젝트 템플릿이 여기에 표시됩니다.
            </p>
          </div>
        ) : (
          <div className="table-scroll hub-template-table-scroll">
            <table className="project-table hub-template-table" aria-label="허브 템플릿 목록">
              <colgroup>
                <col className="hub-template-col-name" />
                <col className="hub-template-col-access" />
                <col className="hub-template-col-created" />
                <col className="hub-template-col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">이름</th>
                  <th scope="col">액세스</th>
                  <th scope="col">작성 날짜</th>
                  <th scope="col" aria-label="작업" />
                </tr>
              </thead>
              <tbody>
                {hubTemplates.map((template) => (
                  <tr key={template.id} data-testid="template-row">
                    <td>
                      <button
                        type="button"
                        className="project-name-button"
                        aria-label={`${template.name} 템플릿 열기`}
                        onClick={() => onOpenTemplate(template.id)}
                      >
                        {template.name}
                      </button>
                    </td>
                    <td>소유자</td>
                    <td>방금 전</td>
                    <td>
                      <button
                        className="table-icon danger"
                        type="button"
                        aria-label={`${template.name} 템플릿 삭제`}
                        onClick={() => onDeleteTemplate(template.id, template.name)}
                      >
                        <Trash2 size={17} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {flowStep === "type" ? (
        <div className="modal-backdrop">
          <div ref={typeModalRef} tabIndex={-1} className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="tmpl-type-title">
            <header className="modal-header">
              <h2 id="tmpl-type-title">템플릿 작성</h2>
              <button className="modal-close" type="button" aria-label="닫기" onClick={() => setFlowStep("none")}>
                <X size={20} />
              </button>
            </header>
            <div className="modal-body">
              <label className="radio-row">
                <input
                  type="radio"
                  name="template-kind"
                  checked={templateKind === "blank"}
                  onChange={() => setTemplateKind("blank")}
                />
                <span>
                  <strong>빈 템플릿 작성</strong>
                  <small>기존 프로젝트에서 템플릿 작성을 선택한 프로젝트의 설정과 구성이 템플릿에 복사되지 않습니다.</small>
                </span>
              </label>
              <label className="radio-row">
                <input
                  type="radio"
                  name="template-kind"
                  checked={templateKind === "existing"}
                  onChange={() => setTemplateKind("existing")}
                />
                <span>
                  <strong>기존 프로젝트에서 템플릿 작성</strong>
                  <small>선택한 프로젝트의 설정과 구성이 새 템플릿으로 복사됩니다.</small>
                </span>
              </label>
            </div>
            <footer className="modal-footer">
              <button type="button" className="secondary-action" onClick={() => setFlowStep("none")}>
                취소
              </button>
              <button type="button" className="primary-action" onClick={() => setFlowStep("name")}>
                다음
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {flowStep === "name" ? (
        <div className="modal-backdrop">
          <form ref={nameModalRef} tabIndex={-1} className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="tmpl-name-title" onSubmit={submitTemplate}>
            <header className="modal-header">
              <h2 id="tmpl-name-title">템플릿 작성</h2>
              <button className="modal-close" type="button" aria-label="닫기" onClick={() => setFlowStep("none")}>
                <X size={20} />
              </button>
            </header>
            <div className="modal-body">
              <label className="field">
                <span>
                  템플릿 이름 <b aria-hidden="true">*</b>
                </span>
                <input
                  name="template-name"
                  aria-label="템플릿 이름"
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  autoFocus
                />
              </label>
              {templateKind === "existing" ? (
                <label className="field select-field">
                  <span>원본 프로젝트</span>
                  <select
                    name="template-source-project"
                    aria-label="원본 프로젝트"
                    value={sourceProject}
                    onChange={(event) => setSourceProject(event.target.value)}
                  >
                    {projects.map((project) => (
                      <option key={project.id} value={project.name}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
            <footer className="modal-footer">
              <button type="button" className="secondary-action" onClick={() => setFlowStep("none")}>
                취소
              </button>
              <button type="submit" className="primary-action">
                템플릿 작성
              </button>
            </footer>
          </form>
        </div>
      ) : null}
    </section>
  );
}

type ProjectCreateModalProps = {
  form: ProjectForm;
  nameError: boolean;
  hubTemplates: HubTemplate[];
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof ProjectForm>(key: K, value: ProjectForm[K]) => void;
};

function ProjectCreateModal({ form, nameError, hubTemplates, onClose, onSubmit, onUpdate }: ProjectCreateModalProps) {
  const dialogRef = useRef<HTMLFormElement>(null);
  useModalDismiss(onClose, dialogRef);
  return (
    <div className="modal-backdrop">
      <form ref={dialogRef} tabIndex={-1} className="project-modal" role="dialog" aria-modal="true" aria-labelledby="project-create-title" onSubmit={onSubmit}>
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
              name="project-name"
              placeholder="프로젝트 이름 입력"
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
              name="project-number"
              placeholder="프로젝트 번호 입력"
              value={form.number}
              onChange={(event) => onUpdate("number", event.target.value)}
            />
          </label>

          <label className="field select-field">
            <span>프로젝트 유형</span>
            <select name="project-type" value={form.projectType} onChange={(event) => onUpdate("projectType", event.target.value)}>
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
            <select name="project-template" value={form.templateId} onChange={(event) => onUpdate("templateId", event.target.value)}>
              <option value="">템플릿 없음 (결정 보류)</option>
              {hubTemplates.length > 0 ? (
                <optgroup label="허브 템플릿">
                  {hubTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              <optgroup label="샘플 템플릿">
                {sampleTemplates.map((template) => (
                  <option key={template.name} value={template.name}>
                    {template.name}
                  </option>
                ))}
              </optgroup>
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
              name="project-address"
              placeholder="위치 입력"
              value={form.address}
              onChange={(event) => onUpdate("address", event.target.value)}
            />
          </label>

          <label className="field select-field">
            <span>
              시간대 <CircleHelp size={13} aria-hidden="true" />
            </span>
            <select name="project-timezone" value={form.timezone} onChange={(event) => onUpdate("timezone", event.target.value)}>
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
                  name="project-start-date"
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
                  name="project-end-date"
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
                name="project-value"
                placeholder="값 입력"
                inputMode="decimal"
                value={form.projectValue}
                onChange={(event) => onUpdate("projectValue", event.target.value)}
              />
            </label>

            <label className="field select-field">
              <span>통화</span>
              <select name="project-currency" value={form.currency} onChange={(event) => onUpdate("currency", event.target.value)}>
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
