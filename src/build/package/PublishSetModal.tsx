import { FileUp, Loader2, X } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { uploadDrawing } from "../../api/drawings";
import { addPackageFiles, createPackage } from "../../api/packages";
import SheetSourceMapper from "./SheetSourceMapper";
import "./package.css";

function classify(name: string): "dwg" | "pdf" {
  const ext = name.split(".").pop()?.toLowerCase();
  return ext === "dwg" || ext === "dxf" ? "dwg" : "pdf";
}

/** 세트 발행 진입점: DWG(들)+PDF(들)를 한 번에 업로드 → draft 패키지 귀속 → 매핑 화면으로. */
export default function PublishSetModal({
  projectName,
  folderId,
  onClose,
  onDone,
}: {
  projectName: string;
  folderId: string | null;
  onClose: () => void;
  onDone: () => void;   // 발행/변경 후 Files 새로고침
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [packageId, setPackageId] = useState<string | null>(null);

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length) setFiles((prev) => [...prev, ...picked]);
  }

  async function handleCreate() {
    if (files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      // 1) 세트의 모든 파일을 기존 변환 파이프라인으로 업로드(변환 코드 무변경).
      const dwgIds: string[] = [];
      const pdfIds: string[] = [];
      for (const f of files) {
        const d = await uploadDrawing(f, projectName, folderId);
        (classify(f.name) === "dwg" ? dwgIds : pdfIds).push(d.file_id);
      }
      // 2) draft 패키지 생성 후 업로드된 file_id 귀속.
      const pkg = await createPackage({ projectName, title, folderId });
      await addPackageFiles(pkg.package_id, { dwgFileIds: dwgIds, pdfFileIds: pdfIds });
      onDone();                       // 업로드분이 Files에 보이도록
      setPackageId(pkg.package_id);   // 매핑 화면 전환
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (packageId) {
    return <SheetSourceMapper packageId={packageId} onClose={onClose} onPublished={onDone} />;
  }

  const dwgCount = files.filter((f) => classify(f.name) === "dwg").length;
  const pdfCount = files.length - dwgCount;

  return (
    <div className="modal-backdrop">
      <div className="project-modal pkg-upload" role="dialog" aria-modal="true" aria-labelledby="pkg-upload-title">
        <header className="modal-header">
          <h2 id="pkg-upload-title">세트 발행 — 파일 제출</h2>
          <button className="modal-close" type="button" aria-label="닫기" onClick={onClose}><X size={22} /></button>
        </header>
        <div className="modal-body">
          <label className="pkg-field">
            <span>세트 제목(선택)</span>
            <input
              name="pkg-title"
              value={title}
              placeholder="예: 2026-07 전기 발행분"
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <input
            ref={inputRef}
            type="file"
            accept=".dwg,.dxf,.pdf"
            multiple
            hidden
            aria-label="세트 파일 선택(DWG/DXF + PDF)"
            onChange={onPick}
          />
          <button type="button" className="upload-dropzone" disabled={busy} onClick={() => inputRef.current?.click()}>
            <FileUp size={36} aria-hidden="true" />
            <span>DWG(들) + 발행 PDF(들)를 함께 선택 (.dwg .dxf .pdf)</span>
          </button>

          {files.length > 0 ? (
            <div className="pkg-filelist">
              <div className="pkg-filelist-head">DWG {dwgCount} · PDF {pdfCount}</div>
              <ul>
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`}>
                    <span className={`pkg-badge ${classify(f.name) === "dwg" ? "pkg-badge-dwg" : "pkg-badge-pdf"}`}>
                      {classify(f.name).toUpperCase()}
                    </span>
                    {f.name}
                    <button type="button" aria-label={`${f.name} 제거`} onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}>
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {error ? <p className="upload-error" role="alert">{error}</p> : null}
          <p className="pkg-hint-text">
            세트 제출이 기본입니다. DWG=소스, PDF=게시 시트. PDF가 시트 경계를 규정하고, 업로드 후 각 시트에 소스 DWG를 수동 연결합니다.
          </p>
        </div>
        <footer className="modal-footer">
          <button className="secondary-action" type="button" onClick={onClose}>취소</button>
          <button className="primary-action" type="button" disabled={busy || files.length === 0} onClick={() => void handleCreate()}>
            {busy ? <Loader2 size={14} className="spin" aria-hidden="true" /> : null} 세트 만들고 매핑
          </button>
        </footer>
      </div>
    </div>
  );
}
