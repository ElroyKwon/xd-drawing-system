import { ChevronDown, Download, Eye, Filter, Folder, Loader2, Maximize2, MonitorUp, MoreVertical, Search, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { fileFolders } from "./buildFilesData";
import { useModalDismiss } from "../hooks/useModalDismiss";
import { getDrawing, sheetImageUrl, uploadDrawing, type BackendSheet, type Drawing } from "../api/drawings";
import type { Sheet } from "../buildSheetsData";

const STATUS_LABEL: Record<Drawing["conversion_status"], string> = {
  pending: "대기",
  converting: "변환 중",
  completed: "완료",
  failed: "실패",
};

export default function FilesView({ onOpenSheet }: { onOpenSheet?: (sheet: Sheet) => void }) {
  const [showWelcome, setShowWelcome] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState("project-root");
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploads, setUploads] = useState<Drawing[]>([]);

  function upsert(d: Drawing) {
    setUploads((prev) => {
      const i = prev.findIndex((x) => x.file_id === d.file_id);
      if (i === -1) return [d, ...prev];
      const next = [...prev];
      next[i] = d;
      return next;
    });
  }

  // 변환 중인 도면을 폴링해 상태/시트를 갱신한다.
  useEffect(() => {
    const pending = uploads.filter((d) => d.conversion_status === "pending" || d.conversion_status === "converting");
    if (pending.length === 0) return;
    const timer = setInterval(() => {
      pending.forEach(async (d) => {
        try {
          upsert(await getDrawing(d.file_id));
        } catch {
          /* 폴링 실패는 다음 주기에 재시도 */
        }
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [uploads]);

  function openInViewer(d: Drawing, s: BackendSheet) {
    onOpenSheet?.({
      id: s.sheet_id,
      projectId: "project-study",
      number: d.filename,
      title: s.sheet_name,
      version: d.version,
      versionSet: "-",
      disciplineCode: "A",
      disciplineLabel: d.file_format.toUpperCase(),
      tag: s.source ?? "",
      lastUpdatedBy: "업로드",
      imageUrl: sheetImageUrl(s),
    });
  }

  return (
    <section className="build-page files-page" aria-labelledby="files-title">
      <div className="build-page-heading">
        <div>
          <h1 id="files-title">파일</h1>
        </div>
      </div>

      {showWelcome ? (
        <div className="files-welcome" role="note">
          <div className="files-welcome-text">
            <strong>Welcome to Files</strong>
            <span>프로젝트 데이터를 한곳에 모아 접근성과 권한 제어를 갖춘 보안 환경에서 관리합니다.</span>
            <div className="files-welcome-actions">
              <button className="primary-action" type="button">개요 보기</button>
              <button className="home-link-button" type="button">자세히 알아보기</button>
              <button className="home-link-button" type="button">과정 등록</button>
            </div>
          </div>
          <div className="files-welcome-art" aria-hidden="true" />
          <button className="modal-close" type="button" aria-label="배너 닫기" onClick={() => setShowWelcome(false)}>
            <X size={20} />
          </button>
        </div>
      ) : null}

      <div className="files-layout">
        <aside className="folder-tree" aria-label="폴더">
          <strong>폴더</strong>
          <button
            type="button"
            aria-current={selectedFolder === "project-root" ? "page" : undefined}
            onClick={() => setSelectedFolder("project-root")}
          >
            <Folder size={15} aria-hidden="true" />
            프로젝트 파일
          </button>
          {fileFolders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              className="folder-tree-child"
              aria-current={selectedFolder === folder.id ? "page" : undefined}
              onClick={() => setSelectedFolder(folder.id)}
            >
              <Folder size={15} aria-hidden="true" />
              {folder.name}
            </button>
          ))}
          <button
            type="button"
            className="folder-tree-grandchild"
            aria-current={selectedFolder === "pdfs" ? "page" : undefined}
            onClick={() => setSelectedFolder("pdfs")}
          >
            <Folder size={15} aria-hidden="true" />
            PDFs
          </button>
        </aside>

        <div className="files-table-panel">
          <div className="files-action-bar">
            <button className="primary-action files-upload-button" type="button" onClick={() => setIsUploadOpen(true)}>
              <Upload size={16} aria-hidden="true" />
              <span>파일 업로드</span>
              <ChevronDown size={15} aria-hidden="true" />
            </button>
            <div className="files-toolbar-right">
              <button className="secondary-action" type="button">
                <Download size={16} aria-hidden="true" />
                <span>내보내기</span>
              </button>
              <label className="search-field sheets-search">
                <Search size={18} aria-hidden="true" />
                <input aria-label="파일 검색" name="file-search" placeholder="검색 및 필터" />
              </label>
              <button className="icon-button" type="button" aria-label="필터">
                <Filter size={18} />
              </button>
            </div>
          </div>

          {uploads.length > 0 ? (
            <div className="files-uploads" aria-label="업로드한 도면">
              <strong className="files-uploads-title">업로드한 도면</strong>
              <ul className="upload-list">
                {uploads.map((d) => (
                  <li key={d.file_id} className="upload-row" data-status={d.conversion_status}>
                    <span className="upload-name">
                      <Folder size={16} aria-hidden="true" />
                      {d.filename}
                    </span>
                    <span className={`status-chip status-${d.conversion_status}`}>
                      {(d.conversion_status === "pending" || d.conversion_status === "converting") && (
                        <Loader2 size={13} className="spin" aria-hidden="true" />
                      )}
                      {STATUS_LABEL[d.conversion_status]}
                      {d.conversion_status === "completed" ? ` · 시트 ${d.sheets.length}` : ""}
                    </span>
                    <span className="upload-sheets">
                      {d.conversion_status === "completed" &&
                        d.sheets.map((s) => (
                          <button key={s.sheet_id} type="button" className="home-link-button" onClick={() => openInViewer(d, s)}>
                            <Eye size={14} aria-hidden="true" />
                            {s.sheet_name} 뷰어로 열기
                          </button>
                        ))}
                      {d.conversion_status === "failed" ? <span className="upload-error">{d.error ?? "변환 실패"}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="table-scroll files-table-scroll">
            <table className="project-table files-table">
              <thead>
                <tr>
                  <th scope="col" aria-label="선택">
                    <input type="checkbox" name="all-files" aria-label="모든 파일 선택" />
                  </th>
                  <th scope="col">이름</th>
                  <th scope="col">설명</th>
                  <th scope="col">버전</th>
                  <th scope="col">공유 상태</th>
                  <th scope="col">마크업</th>
                  <th scope="col">이슈</th>
                  <th scope="col">크기</th>
                  <th scope="col">마지막 업데이트</th>
                  <th scope="col">최종 수정자</th>
                  <th scope="col">버전 추가자</th>
                  <th scope="col" aria-label="행 메뉴" />
                </tr>
              </thead>
              <tbody>
                {fileFolders.map((folder) => (
                  <tr key={folder.id}>
                    <td>
                      <input type="checkbox" name={folder.id} aria-label={`${folder.name} 선택`} />
                    </td>
                    <td>
                      <span className="file-name-cell">
                        <Folder size={16} aria-hidden="true" />
                        {folder.name}
                      </span>
                    </td>
                    <td>--</td>
                    <td>--</td>
                    <td>--</td>
                    <td>--</td>
                    <td>--</td>
                    <td>--</td>
                    <td>{folder.updatedAt}</td>
                    <td>
                      <span className="updater-avatar">FP</span>
                      <span>{folder.updatedBy}</span>
                    </td>
                    <td>--</td>
                    <td>
                      <button className="table-icon" type="button" aria-label={`${folder.name} 메뉴`}>
                        <MoreVertical size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination" aria-label="파일 페이지네이션">
            <span>11개 항목 표시 중</span>
          </div>
        </div>
      </div>

      {isUploadOpen ? <FileUploadModal onClose={() => setIsUploadOpen(false)} onUploaded={upsert} /> : null}
    </section>
  );
}

function FileUploadModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: (d: Drawing) => void }) {
  const dialogRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useModalDismiss(onClose, dialogRef);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        onUploaded(await uploadDrawing(file));
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    void handleFiles(event.target.files);
  }

  return (
    <div className="modal-backdrop">
      <form ref={dialogRef} tabIndex={-1} className="project-modal file-upload-modal" role="dialog" aria-modal="true" aria-labelledby="file-upload-title" onSubmit={(e) => e.preventDefault()}>
        <header className="modal-header">
          <h2 id="file-upload-title">파일 업로드</h2>
          <div className="modal-header-actions">
            <button className="modal-close" type="button" aria-label="확대">
              <Maximize2 size={18} />
            </button>
            <button className="modal-close" type="button" aria-label="닫기" onClick={onClose}>
              <X size={22} />
            </button>
          </div>
        </header>
        <div className="upload-tabs" role="tablist" aria-label="업로드 소스">
          <button type="button" role="tab" aria-selected="true">
            <MonitorUp size={16} aria-hidden="true" />
            컴퓨터에서
          </button>
        </div>
        <div className="modal-body">
          <input
            ref={inputRef}
            type="file"
            accept=".dwg,.dxf,.pdf"
            multiple
            hidden
            aria-label="도면 파일 선택"
            onChange={onInputChange}
          />
          <button
            type="button"
            className="upload-dropzone"
            aria-label="파일 선택"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? <Loader2 size={40} className="spin" aria-hidden="true" /> : <Upload size={40} aria-hidden="true" />}
            <span>{busy ? "업로드 중..." : "여기를 눌러 파일을 선택하십시오 (.dwg .dxf .pdf)"}</span>
          </button>
          {error ? <p className="upload-error" role="alert">{error}</p> : null}
        </div>
        <footer className="modal-footer upload-modal-footer">
          <button className="home-link-button" type="button">이 파일이 모델임을 의미합니까?</button>
          <button className="primary-action" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
            파일 선택
          </button>
        </footer>
      </form>
    </div>
  );
}
