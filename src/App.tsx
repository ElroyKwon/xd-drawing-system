import {
  Bookmark,
  CalendarDays,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  CircleHelp,
  FileText,
  Filter,
  Hammer,
  ListFilter,
  MapPin,
  Pencil,
  Plus,
  Search,
  Settings,
  X
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import BuildSheetsView from "./BuildSheetsView";
import ProjectAdminView from "./ProjectAdminView";
import { useModalDismiss } from "./hooks/useModalDismiss";
import { initialProjectAccess, type ProjectMemberAccess } from "./projectAdminData";
import { createProject as apiCreateProject, getMe, listMembers, listProjects, switchUser, type Me, type Member } from "./api/admin";

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
    "my-home" | "projects" | "project-templates" | "project-admin" | "template-admin" | "build-sheets"
  >("projects");
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
    apiCreateProject<Project>(createdProject).catch(() => {/* 백엔드 미가동 폴백 — 로컬 유지 */});
  }

  function openProject(projectId: string) {
    setSelectedProjectId(projectId);
    setActiveView("project-admin");
  }

  function openBuild(projectId: string) {
    setSelectedProjectId(projectId);
    setActiveView("build-sheets");
  }

  function addHubTemplate(name: string) {
    setHubTemplates((current) => [...current, { id: `template-${Date.now()}`, name }]);
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
    return <BuildSheetsView project={selectedProject} onBackToProjects={() => setActiveView("projects")} />;
  }

  return (
    <main className="app-shell">
      <BrandBar me={me} members={members} onSwitch={handleSwitchUser} />

      <section className="workspace">
        <HubAdminBar />

        <div className="hero-row">
          <div>
            <h1>{me?.member?.name ?? "사용자"} 님, 환영합니다.</h1>
            <p>오늘 무엇을 하시겠습니까?</p>
          </div>
        </div>

        <nav className="tabs" aria-label="허브 메뉴">
          <button type="button" role="tab" aria-selected={activeView === "my-home"} onClick={() => setActiveView("my-home")}>
            My Home
          </button>
          <button type="button" role="tab" aria-selected={activeView === "projects"} onClick={() => setActiveView("projects")}>
            프로젝트
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === "project-templates"}
            onClick={() => setActiveView("project-templates")}
          >
            프로젝트 템플릿
          </button>
        </nav>

        {activeView === "my-home" ? (
          <MyHomeView onOpenProject={openProject} />
        ) : activeView === "project-templates" ? (
          <ProjectTemplatesView
            hubTemplates={hubTemplates}
            onCreateTemplate={addHubTemplate}
            onUseTemplate={openModalWithTemplate}
            onOpenTemplate={openTemplateAdmin}
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
        )}
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

function BrandBar({ me, members, onSwitch }: { me: Me | null; members: Member[]; onSwitch: (memberId: string) => void }) {
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
      <div className="brand">
        <span className="brand-mark">XD</span>
        <span>Drawing System</span>
      </div>

      <div className="brand-tools">
        <span className="trial-text">평가판 - XD Build Essentials이(가) 23일 남음</span>
        <button type="button" className="buy-button">
          지금 구입
        </button>
        <button type="button" className="round-button" aria-label="도움말">
          <CircleHelp size={18} />
        </button>
        <div className="user-switch" ref={ref}>
          <button type="button" className="avatar" aria-label="사용자 메뉴" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((v) => !v)}>
            {name} <ChevronDown size={14} />
          </button>
          {open ? (
            <div className="user-switch-menu" role="menu">
              <p className="user-switch-head">사용자 전환 (로컬 모의)</p>
              {members.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={me?.member_id === m.id}
                  className={me?.member_id === m.id ? "is-current" : ""}
                  onClick={() => { onSwitch(m.id); setOpen(false); }}
                >
                  {m.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function HubAdminBar() {
  return (
    <div className="hub-admin-bar">
      <div className="hub-label">
        <span className="hub-icon" aria-hidden="true">
          <Settings size={16} />
        </span>
        <span>Hub Admin</span>
      </div>

      <div className="product-strip" aria-label="관련 제품">
        <span>더 많은 XD 제품</span>
        <span className="product-pill">xD-HUB</span>
        <span className="product-pill">xD-Works</span>
        <span className="product-pill">xD-ACS</span>
        <span className="product-pill">xD-Cost</span>
        <span className="product-pill">xD-Specs</span>
      </div>
    </div>
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
  onCreateTemplate: (name: string) => void;
  onUseTemplate: (templateName: string) => void;
  onOpenTemplate: (templateId: string) => void;
};

function ProjectTemplatesView({ hubTemplates, onCreateTemplate, onUseTemplate, onOpenTemplate }: ProjectTemplatesViewProps) {
  const [flowStep, setFlowStep] = useState<"none" | "type" | "name">("none");
  const [templateKind, setTemplateKind] = useState<"blank" | "existing">("blank");
  const [templateName, setTemplateName] = useState("");
  const [sampleOpen, setSampleOpen] = useState(true);
  const typeModalRef = useRef<HTMLDivElement>(null);
  const nameModalRef = useRef<HTMLFormElement>(null);
  useModalDismiss(() => setFlowStep("none"), typeModalRef, flowStep === "type");
  useModalDismiss(() => setFlowStep("none"), nameModalRef, flowStep === "name");

  function startFlow() {
    setTemplateKind("blank");
    setTemplateName("");
    setFlowStep("type");
  }

  function submitTemplate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = templateName.trim();
    if (!name) {
      return;
    }
    onCreateTemplate(name);
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
          <div className="table-scroll">
            <table className="project-table">
              <thead>
                <tr>
                  <th scope="col">이름</th>
                  <th scope="col">액세스</th>
                  <th scope="col">작성 날짜</th>
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
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUpdate: <K extends keyof ProjectForm>(key: K, value: ProjectForm[K]) => void;
};

function ProjectCreateModal({ form, nameError, onClose, onSubmit, onUpdate }: ProjectCreateModalProps) {
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
              {sampleTemplates.map((template) => (
                <option key={template.name} value={template.name}>
                  {template.name}
                </option>
              ))}
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
