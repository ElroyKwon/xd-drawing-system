import { ClipboardList } from "lucide-react";

export default function FormsView() {
  return (
    <section className="build-page" aria-labelledby="forms-title">
      <div className="build-page-heading">
        <div>
          <h1 id="forms-title">양식</h1>
          <p>스크린샷 근거 보강 필요</p>
        </div>
        <button className="secondary-action" type="button">
          <ClipboardList size={16} aria-hidden="true" />
          양식 템플릿
        </button>
      </div>
      <div className="empty-module-state">
        <strong>양식 화면 원본 보강 대기</strong>
        <span>ACC 분석 문서에서 캡처 누락 항목으로 분류된 로컬 shell입니다.</span>
      </div>
    </section>
  );
}
