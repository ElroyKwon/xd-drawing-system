import {
  ChevronDown, Download, Eye, Filter, Folder, FolderPlus, History, Loader2,
  Maximize2, MonitorUp, MoreVertical, Pencil, Search, Share2, Trash2, Upload, UploadCloud, X,
} from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useModalDismiss } from "../hooks/useModalDismiss";
import {
  addDrawingVersion, createFolder, deleteDrawing, deleteFolder, downloadUrl, getDrawing,
  listDrawings, listDrawingVersions, listFolders, sheetImageUrl, updateFolder, uploadDrawing,
  type BackendSheet, type Drawing, type Folder as FolderMeta,
} from "../api/drawings";
import type { Sheet } from "../buildSheetsData";

const PROJECT = "Study_Project";

const STATUS_LABEL: Record<Drawing["conversion_status"], string> = {
  pending: "대기",
  converting: "변환 중",
  completed: "완료",
  failed: "실패",
};

function formatSize(b?: number): string {
  if (!b) return "--";
  const units = ["B", "KB", "MB", "GB"];
  let n = b;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
}

function formatDate(iso?: string): string {
  if (!iso) return "--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

export default function FilesView({ onOpenSheet }: { onOpenSheet?: (sheet: Sheet) => void }) {
  const [showWelcome, setShowWelcome] = useState(true);
  const [folders, setFolders] = useState<FolderMeta[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [versionsFor, setVersionsFor] = useState<Drawing | null>(null);
  const [versionList, setVersionList] = useState<Drawing[]>([]);
  const addVersionInputRef = useRef<HTMLInputElement>(null);
  const addVersionTarget = useRef<string | null>(null);

  async function refreshFolders() {
    try {
      setFolders(await listFolders(PROJECT));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function refreshDrawings(folderId: string | null) {
    setLoading(true);
    try {
      setDrawings(await listDrawings(PROJECT, { folderId: folderId ?? "", latestOnly: true }));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshFolders();
  }, []);

  useEffect(() => {
    void refreshDrawings(selectedFolderId);
  }, [selectedFolderId]);

  // 변환 중인 도면을 폴링해 상태/시트를 갱신한다.
  useEffect(() => {
    const pending = drawings.filter((d) => d.conversion_status === "pending" || d.conversion_status === "converting");
    if (pending.length === 0) return;
    const timer = setInterval(() => {
      pending.forEach(async (d) => {
        try {
          const fresh = await getDrawing(d.file_id);
          setDrawings((prev) => prev.map((x) => (x.file_id === fresh.file_id ? fresh : x)));
        } catch {
          /* 다음 주기 재시도 */
        }
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [drawings]);

  const currentFolder = folders.find((f) => f.folder_id === selectedFolderId) ?? null;
  const childFolders = folders.filter((f) => (f.parent_id ?? null) === selectedFolderId);
  const shareStatus = currentFolder?.share_status ?? "비공개";

  function openInViewer(d: Drawing, s: BackendSheet) {
    onOpenSheet?.({
      id: s.sheet_id,
      projectId: "project-study",
      number: s.sheet_number || d.filename,
      title: s.sheet_title || s.sheet_name,
      version: d.version,
      versionSet: "-",
      disciplineCode: "A",
      disciplineLabel: d.file_format.toUpperCase(),
      tag: s.source ?? "",
      lastUpdatedBy: d.uploaded_by ?? "업로드",
      imageUrl: sheetImageUrl(s),
      fileId: d.file_id,
      source: s.source,
    });
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      await createFolder({ projectName: PROJECT, name, parentId: selectedFolderId });
      setNewFolderName("");
      setNewFolderOpen(false);
      await refreshFolders();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleRenameFolder(folder: FolderMeta) {
    setMenuOpenId(null);
    const name = window.prompt("폴더 이름", folder.name);
    if (!name || !name.trim() || name.trim() === folder.name) return;
    try {
      await updateFolder(folder.folder_id, { name: name.trim() });
      await refreshFolders();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleToggleShare(folder: FolderMeta) {
    setMenuOpenId(null);
    const next = folder.share_status === "비공개" ? "프로젝트 공유" : "비공개";
    try {
      await updateFolder(folder.folder_id, { share_status: next });
      await refreshFolders();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleDeleteFolder(folder: FolderMeta) {
    setMenuOpenId(null);
    if (!window.confirm(`'${folder.name}' 폴더와 하위 폴더를 삭제할까요? (소속 파일은 보존됩니다)`)) return;
    try {
      await deleteFolder(folder.folder_id);
      if (selectedFolderId === folder.folder_id) setSelectedFolderId(null);
      await refreshFolders();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleDeleteDrawing(d: Drawing) {
    setMenuOpenId(null);
    if (!window.confirm(`'${d.filename}'을(를) 삭제할까요?`)) return;
    try {
      await deleteDrawing(d.file_id);
      await refreshDrawings(selectedFolderId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function triggerAddVersion(fileId: string) {
    setMenuOpenId(null);
    addVersionTarget.current = fileId;
    addVersionInputRef.current?.click();
  }

  async function onAddVersionFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    const target = addVersionTarget.current;
    if (!file || !target) return;
    try {
      await addDrawingVersion(target, file);
      await refreshDrawings(selectedFolderId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function showVersions(d: Drawing) {
    setMenuOpenId(null);
    try {
      const vs = await listDrawingVersions(d.file_id);
      setVersionList(vs);
      setVersionsFor(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function renderTreeNodes(parentId: string | null, depth: number) {
    const nodes = folders.filter((f) => (f.parent_id ?? null) === parentId);
    return nodes.map((folder) => (
      <div key={folder.folder_id}>
        <button
          type="button"
          className={depth > 0 ? "folder-tree-child" : undefined}
          style={depth > 1 ? { paddingLeft: 12 + depth * 14 } : undefined}
          aria-current={selectedFolderId === folder.folder_id ? "page" : undefined}
          onClick={() => setSelectedFolderId(folder.folder_id)}
        >
          <Folder size={15} aria-hidden="true" />
          {folder.name}
        </button>
        {renderTreeNodes(folder.folder_id, depth + 1)}
      </div>
    ));
  }

  const totalRows = childFolders.length + drawings.length;

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
          <div className="folder-tree-head">
            <strong>폴더</strong>
            <button type="button" className="icon-button" aria-label="새 폴더" onClick={() => setNewFolderOpen((v) => !v)}>
              <FolderPlus size={16} />
            </button>
          </div>
          <button
            type="button"
            aria-current={selectedFolderId === null ? "page" : undefined}
            onClick={() => setSelectedFolderId(null)}
          >
            <Folder size={15} aria-hidden="true" />
            프로젝트 파일
          </button>
          {renderTreeNodes(null, 1)}
          {newFolderOpen ? (
            <div className="folder-new-inline">
              <input
                aria-label="새 폴더 이름"
                name="new-folder-name"
                value={newFolderName}
                autoFocus
                placeholder="새 폴더 이름"
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreateFolder();
                  if (e.key === "Escape") setNewFolderOpen(false);
                }}
              />
              <button type="button" className="primary-action" onClick={() => void handleCreateFolder()}>
                추가
              </button>
            </div>
          ) : null}
        </aside>

        <div className="files-table-panel">
          <div className="files-action-bar">
            <button className="primary-action files-upload-button" type="button" onClick={() => setIsUploadOpen(true)}>
              <Upload size={16} aria-hidden="true" />
              <span>파일 업로드</span>
              <ChevronDown size={15} aria-hidden="true" />
            </button>
            <div className="files-breadcrumb" aria-live="polite">
              {currentFolder ? (
                <>
                  <Folder size={14} aria-hidden="true" /> {currentFolder.name}
                  <span className={`share-chip share-${shareStatus === "비공개" ? "private" : "shared"}`}>{shareStatus}</span>
                </>
              ) : (
                <>프로젝트 파일</>
              )}
            </div>
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

          {error ? <p className="upload-error" role="alert">{error}</p> : null}

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
                {childFolders.map((folder) => (
                  <tr key={folder.folder_id} className="files-row-folder">
                    <td>
                      <input type="checkbox" name={folder.folder_id} aria-label={`${folder.name} 선택`} />
                    </td>
                    <td>
                      <button type="button" className="file-name-cell file-name-link" onClick={() => setSelectedFolderId(folder.folder_id)}>
                        <Folder size={16} aria-hidden="true" />
                        {folder.name}
                      </button>
                    </td>
                    <td>--</td>
                    <td>--</td>
                    <td>
                      <span className={`share-chip share-${folder.share_status === "비공개" ? "private" : "shared"}`}>
                        {folder.share_status}
                      </span>
                    </td>
                    <td>--</td>
                    <td>--</td>
                    <td>--</td>
                    <td>{formatDate(folder.updated_at)}</td>
                    <td>{folder.updated_by}</td>
                    <td>--</td>
                    <td className="files-row-menu-cell">
                      <button
                        className="table-icon"
                        type="button"
                        aria-label={`${folder.name} 메뉴`}
                        onClick={() => setMenuOpenId(menuOpenId === folder.folder_id ? null : folder.folder_id)}
                      >
                        <MoreVertical size={18} />
                      </button>
                      {menuOpenId === folder.folder_id ? (
                        <ul className="row-menu" role="menu">
                          <li>
                            <button type="button" role="menuitem" onClick={() => void handleRenameFolder(folder)}>
                              <Pencil size={14} /> 이름 변경
                            </button>
                          </li>
                          <li>
                            <button type="button" role="menuitem" onClick={() => void handleToggleShare(folder)}>
                              <Share2 size={14} /> {folder.share_status === "비공개" ? "프로젝트 공유로 전환" : "비공개로 전환"}
                            </button>
                          </li>
                          <li>
                            <button type="button" role="menuitem" onClick={() => void handleDeleteFolder(folder)}>
                              <Trash2 size={14} /> 삭제
                            </button>
                          </li>
                        </ul>
                      ) : null}
                    </td>
                  </tr>
                ))}

                {drawings.map((d) => {
                  const firstSheet = d.sheets?.[0];
                  const fileShare = d.share_status ?? "비공개";
                  return (
                    <tr key={d.file_id} data-status={d.conversion_status}>
                      <td>
                        <input type="checkbox" name={d.file_id} aria-label={`${d.filename} 선택`} />
                      </td>
                      <td>
                        <span className="file-name-cell">
                          <Folder size={16} aria-hidden="true" />
                          {d.filename}
                          {d.conversion_status !== "completed" ? (
                            <span className={`status-chip status-${d.conversion_status}`}>
                              {(d.conversion_status === "pending" || d.conversion_status === "converting") && (
                                <Loader2 size={12} className="spin" aria-hidden="true" />
                              )}
                              {STATUS_LABEL[d.conversion_status]}
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td>--</td>
                      <td>v{d.version_no ?? 1}</td>
                      <td>
                        <span className={`share-chip share-${fileShare === "비공개" ? "private" : "shared"}`}>{fileShare}</span>
                      </td>
                      <td title="마크업은 S4에서 연결됩니다">0</td>
                      <td title="이슈는 S5에서 연결됩니다">0</td>
                      <td>{formatSize(d.file_size)}</td>
                      <td>{formatDate(d.upload_date)}</td>
                      <td>{d.uploaded_by ?? "업로드"}</td>
                      <td>{d.uploaded_by ?? "업로드"}</td>
                      <td className="files-row-menu-cell">
                        <button
                          className="table-icon"
                          type="button"
                          aria-label={`${d.filename} 메뉴`}
                          onClick={() => setMenuOpenId(menuOpenId === d.file_id ? null : d.file_id)}
                        >
                          <MoreVertical size={18} />
                        </button>
                        {menuOpenId === d.file_id ? (
                          <ul className="row-menu" role="menu">
                            {d.conversion_status === "completed" && firstSheet ? (
                              <li>
                                <button type="button" role="menuitem" onClick={() => { setMenuOpenId(null); openInViewer(d, firstSheet); }}>
                                  <Eye size={14} /> 뷰어로 열기
                                </button>
                              </li>
                            ) : null}
                            <li>
                              <a role="menuitem" href={downloadUrl(d.file_id)} download={d.filename} onClick={() => setMenuOpenId(null)}>
                                <Download size={14} /> 다운로드
                              </a>
                            </li>
                            <li>
                              <button type="button" role="menuitem" onClick={() => triggerAddVersion(d.file_id)}>
                                <UploadCloud size={14} /> 새 버전 추가
                              </button>
                            </li>
                            <li>
                              <button type="button" role="menuitem" onClick={() => void showVersions(d)}>
                                <History size={14} /> 버전 이력
                              </button>
                            </li>
                            <li>
                              <button type="button" role="menuitem" onClick={() => void handleDeleteDrawing(d)}>
                                <Trash2 size={14} /> 삭제
                              </button>
                            </li>
                          </ul>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}

                {totalRows === 0 && !loading ? (
                  <tr>
                    <td colSpan={12} className="files-empty">이 폴더에 항목이 없습니다. 파일을 업로드하거나 폴더를 만드세요.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="pagination" aria-label="파일 페이지네이션">
            <span>
              {loading ? "불러오는 중..." : `${totalRows}개 항목 표시 중`}
            </span>
          </div>
        </div>
      </div>

      <input
        ref={addVersionInputRef}
        type="file"
        accept=".dwg,.dxf,.pdf"
        hidden
        aria-label="새 버전 파일 선택"
        onChange={onAddVersionFile}
      />

      {isUploadOpen ? (
        <FileUploadModal
          folderId={selectedFolderId}
          onClose={() => setIsUploadOpen(false)}
          onUploaded={() => void refreshDrawings(selectedFolderId)}
        />
      ) : null}

      {versionsFor ? (
        <VersionHistoryModal
          drawing={versionsFor}
          versions={versionList}
          onClose={() => setVersionsFor(null)}
        />
      ) : null}
    </section>
  );
}

function VersionHistoryModal({ drawing, versions, onClose }: { drawing: Drawing; versions: Drawing[]; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalDismiss(onClose, dialogRef);
  return (
    <div className="modal-backdrop">
      <div ref={dialogRef} tabIndex={-1} className="project-modal" role="dialog" aria-modal="true" aria-labelledby="version-history-title">
        <header className="modal-header">
          <h2 id="version-history-title">버전 이력 — {drawing.filename}</h2>
          <button className="modal-close" type="button" aria-label="닫기" onClick={onClose}>
            <X size={22} />
          </button>
        </header>
        <div className="modal-body">
          <table className="project-table">
            <thead>
              <tr>
                <th scope="col">버전</th>
                <th scope="col">파일명</th>
                <th scope="col">크기</th>
                <th scope="col">업로드 일시</th>
                <th scope="col">추가자</th>
                <th scope="col">상태</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.file_id}>
                  <td>v{v.version_no ?? 1}{v.is_latest ? " (최신)" : ""}</td>
                  <td>{v.filename}</td>
                  <td>{formatSize(v.file_size)}</td>
                  <td>{formatDate(v.upload_date)}</td>
                  <td>{v.uploaded_by ?? "업로드"}</td>
                  <td>
                    <a href={downloadUrl(v.file_id)} download={v.filename}>
                      <Download size={14} aria-hidden="true" /> 다운로드
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FileUploadModal({
  folderId,
  onClose,
  onUploaded,
}: {
  folderId: string | null;
  onClose: () => void;
  onUploaded: (d: Drawing) => void;
}) {
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
        onUploaded(await uploadDrawing(file, PROJECT, folderId));
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
