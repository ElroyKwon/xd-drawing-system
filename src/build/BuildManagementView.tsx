import { useEffect, useState } from "react";
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

  // S7: 구성원 섹션은 project_member 실데이터(하드코딩 문자열 제거).
  useEffect(() => {
    if (section !== "구성원") return;
    let alive = true;
    listProjectMembers(projectName)
      .then((rows) => alive && setMembers(rows))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [section, projectName]);

  const copy: Record<SecondarySection, { title: string; lead: string }> = {
    구성원: { title: "Build 구성원", lead: "프로젝트 작업 구성원" },
    브리지: { title: "Build 브리지", lead: "전송된 항목 없음" },
    설정: { title: "Build 설정", lead: "프로젝트 작업 설정" }
  };
  const staticRows: Record<Exclude<SecondarySection, "구성원">, string[]> = {
    브리지: ["수신 대기", "송신 대기"],
    설정: ["시트 번호 규칙", "이슈 유형", "파일 권한"]
  };
  const content = copy[section];

  return (
    <section className="build-page" aria-labelledby={`build-${section}-title`}>
      <div className="build-page-heading">
        <div>
          <h1 id={`build-${section}-title`}>{content.title}</h1>
          <p>{content.lead}</p>
        </div>
      </div>
      <div className="section-list">
        {section === "구성원" ? (
          members.length === 0 ? (
            <div className="section-list-row">
              <span>등록된 구성원이 없습니다.</span>
            </div>
          ) : (
            members.map((m) => (
              <div className="section-list-row" key={m.member_id}>
                <span>{m.name} · {m.role}</span>
                <strong>{m.status}</strong>
              </div>
            ))
          )
        ) : (
          staticRows[section].map((row) => (
            <div className="section-list-row" key={row}>
              <span>{row}</span>
              <strong>로컬 shell</strong>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
