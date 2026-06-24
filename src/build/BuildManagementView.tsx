import type { SecondarySection } from "./nav";

export default function BuildManagementView({ section }: { section: SecondarySection }) {
  const copy: Record<SecondarySection, { title: string; lead: string; rows: string[] }> = {
    구성원: {
      title: "Build 구성원",
      lead: "프로젝트 작업 구성원",
      rows: ["개혁 이 · 관리자", "도면 검토자 · 편집자"]
    },
    브리지: {
      title: "Build 브리지",
      lead: "전송된 항목 없음",
      rows: ["수신 대기", "송신 대기"]
    },
    설정: {
      title: "Build 설정",
      lead: "프로젝트 작업 설정",
      rows: ["시트 번호 규칙", "이슈 유형", "파일 권한"]
    }
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
        {content.rows.map((row) => (
          <div className="section-list-row" key={row}>
            <span>{row}</span>
            <strong>로컬 shell</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
