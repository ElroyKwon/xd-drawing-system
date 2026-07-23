import {
  ArrowLeftRight,
  Check,
  Filter,
  Link2,
  Search,
  Settings,
  ShieldCheck,
  Users
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { listProjectMembers, type ProjectMemberRow } from "../api/admin";
import type { SecondarySection } from "./nav";

export default function BuildManagementView({
  section,
  projectName = "Study_Project"
}: {
  section: SecondarySection;
  projectName?: string;
}) {
  const [members, setMembers] = useState<ProjectMemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");

  useEffect(() => {
    if (section !== "구성원") return;
    let alive = true;
    setMembersLoading(true);
    listProjectMembers(projectName)
      .then((rows) => {
        if (alive) setMembers(rows);
      })
      .catch(() => {
        if (alive) setMembers([]);
      })
      .finally(() => {
        if (alive) setMembersLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [section, projectName]);

  const filteredMembers = useMemo(() => {
    const normalizedQuery = memberQuery.trim().toLocaleLowerCase();
    if (!normalizedQuery) return members;
    return members.filter((member) =>
      [member.name, member.email, member.role, member.status]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery)
    );
  }, [memberQuery, members]);

  if (section === "구성원") {
    return (
      <section className="build-page" aria-labelledby="build-members-title">
        <BuildHeading
          id="build-members-title"
          title="Build 구성원"
          lead={`${projectName}에서 Build를 사용하는 구성원과 역할을 확인합니다.`}
        />

        <div className="build-management-panel">
          <div className="build-management-toolbar">
            <div className="build-management-summary">
              <Users size={18} aria-hidden="true" />
              <strong>프로젝트 구성원</strong>
              <span>{members.length}명</span>
            </div>
            <div className="build-management-tools">
              <label className="search-field">
                <Search size={17} aria-hidden="true" />
                <input
                  aria-label="구성원 검색"
                  value={memberQuery}
                  onChange={(event) => setMemberQuery(event.target.value)}
                  placeholder="이름 또는 이메일 검색"
                />
              </label>
              <button className="icon-button" type="button" aria-label="구성원 필터">
                <Filter size={18} />
              </button>
            </div>
          </div>

          {membersLoading ? (
            <div className="build-table-loading" role="status">
              <span className="loading-spinner" aria-hidden="true" />
              구성원을 불러오는 중입니다.
            </div>
          ) : filteredMembers.length > 0 ? (
            <div className="build-management-table-scroll">
              <table className="project-table build-members-table">
                <colgroup>
                  <col className="build-members-col-name" />
                  <col className="build-members-col-email" />
                  <col className="build-members-col-role" />
                  <col className="build-members-col-status" />
                  <col className="build-members-col-date" />
                </colgroup>
                <thead>
                  <tr>
                    <th>이름</th>
                    <th>이메일</th>
                    <th>역할</th>
                    <th>상태</th>
                    <th>추가된 일시</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => (
                    <tr key={member.member_id}>
                      <td><strong>{member.name}</strong></td>
                      <td>{member.email}</td>
                      <td>{member.role}</td>
                      <td><span className={`management-status ${member.status === "활성" ? "is-active" : ""}`}>{member.status}</span></td>
                      <td>{formatDate(member.added_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="build-management-empty" role="status">
              <span className="build-table-empty-icon" aria-hidden="true"><Users size={24} /></span>
              <strong>{memberQuery ? "검색 결과가 없습니다" : "등록된 구성원이 없습니다"}</strong>
              <span>{memberQuery ? "다른 이름이나 이메일로 검색해 보세요." : "Project Admin에서 구성원을 추가하면 이곳에 표시됩니다."}</span>
            </div>
          )}
        </div>
      </section>
    );
  }

  if (section === "브리지") {
    return (
      <section className="build-page" aria-labelledby="build-bridge-title">
        <BuildHeading
          id="build-bridge-title"
          title="Build 브리지"
          lead="다른 프로젝트와 공유하는 파일 및 시트의 연결 상태를 관리합니다."
        />

        <div className="build-management-metrics" aria-label="브리지 현황">
          <ManagementMetric label="연결된 프로젝트" value="0" icon={<Link2 size={19} />} />
          <ManagementMetric label="수신 항목" value="0" icon={<ArrowLeftRight size={19} />} />
          <ManagementMetric label="송신 항목" value="0" icon={<ArrowLeftRight size={19} />} />
        </div>

        <div className="build-management-panel">
          <div className="build-management-section-head">
            <div>
              <h2>프로젝트 브리지</h2>
              <p>프로젝트 간 최신 자료를 한곳에서 추적합니다.</p>
            </div>
          </div>
          <div className="build-management-empty" role="status">
            <span className="build-table-empty-icon" aria-hidden="true"><ArrowLeftRight size={24} /></span>
            <strong>연결된 프로젝트가 없습니다</strong>
            <span>브리지를 연결하면 다른 프로젝트의 파일과 시트를 이곳에서 확인할 수 있습니다.</span>
            <button className="primary-action" type="button"><Link2 size={16} /> 브리지 연결</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="build-page" aria-labelledby="build-settings-title">
      <BuildHeading
        id="build-settings-title"
        title="Build 설정"
        lead={`${projectName}의 번호 체계, 유형 및 기본 권한을 관리합니다.`}
      />

      <div className="build-settings-grid">
        <SettingCard
          icon={<Settings size={20} />}
          title="시트 번호 규칙"
          description="새 시트를 등록할 때 적용할 기본 번호 형식입니다."
        >
          <label>
            번호 형식
            <select defaultValue="discipline">
              <option value="discipline">분야-구분-일련번호</option>
              <option value="sequence">일련번호</option>
            </select>
          </label>
        </SettingCard>

        <SettingCard
          icon={<Check size={20} />}
          title="이슈 유형"
          description="프로젝트에서 기본으로 사용할 이슈 분류입니다."
        >
          <label>
            기본 유형
            <select defaultValue="coordination">
              <option value="coordination">조정</option>
              <option value="quality">품질</option>
              <option value="safety">안전</option>
            </select>
          </label>
        </SettingCard>

        <SettingCard
          icon={<ShieldCheck size={20} />}
          title="파일 기본 권한"
          description="새 폴더와 파일에 적용되는 기본 공유 범위입니다."
        >
          <label>
            기본 공유 범위
            <select defaultValue="project">
              <option value="project">프로젝트 구성원</option>
              <option value="restricted">제한됨</option>
            </select>
          </label>
        </SettingCard>
      </div>

      <div className="build-settings-footer">
        <span>변경 내용은 이 프로젝트에만 적용됩니다.</span>
        <button className="primary-action" type="button">변경사항 저장</button>
      </div>
    </section>
  );
}

function BuildHeading({ id, title, lead }: { id: string; title: string; lead: string }) {
  return (
    <div className="build-page-heading">
      <div>
        <h1 id={id}>{title}</h1>
        <p>{lead}</p>
      </div>
    </div>
  );
}

function ManagementMetric({
  label,
  value,
  icon
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <article className="build-management-metric">
      <span className="build-management-metric-icon" aria-hidden="true">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function SettingCard({
  icon,
  title,
  description,
  children
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <article className="build-setting-card">
      <div className="build-setting-card-head">
        <span aria-hidden="true">{icon}</span>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {children}
    </article>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "-";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(date);
}
