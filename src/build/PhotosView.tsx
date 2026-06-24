import { Image, Map, Upload } from "lucide-react";

export default function PhotosView() {
  return (
    <section className="build-page" aria-labelledby="photos-title">
      <div className="build-page-heading">
        <div>
          <h1 id="photos-title">사진</h1>
          <p>프로젝트 사진</p>
        </div>
        <button className="primary-action" type="button">
          <Upload size={16} aria-hidden="true" />
          미디어 추가
        </button>
      </div>
      <div className="photo-tabs" role="tablist" aria-label="사진 보기">
        <button type="button" role="tab" aria-selected="true">
          앨범
        </button>
        <button type="button" role="tab" aria-selected="false">
          갤러리
        </button>
        <button type="button" role="tab" aria-selected="false">
          맵
        </button>
      </div>
      <div className="photo-layout">
        <aside className="folder-tree" aria-label="사진 앨범">
          <strong>앨범</strong>
          <button type="button" aria-current="page">현장</button>
          <button type="button">검수</button>
          <button type="button">마감</button>
        </aside>
        <div className="photo-empty">
          <Image size={42} aria-hidden="true" />
          <strong>갤러리 비어 있음</strong>
          <span>맵 보기와 앨범 구조만 로컬로 표시합니다.</span>
          <Map size={28} aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
