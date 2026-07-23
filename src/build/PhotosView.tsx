import { Image as ImageIcon, Link2, Search, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deletePhoto as apiDeletePhoto,
  listPhotos,
  photoSrc,
  updatePhoto,
  uploadPhoto,
  type Photo
} from "../api/photos";
import type { Sheet } from "../buildSheetsData";
import { useModalDismiss } from "../hooks/useModalDismiss";

type LinkFilter = "전체" | "연결" | "미연결";

export default function PhotosView({
  projectName = "Study_Project",
  sheets = [],
  canEdit = true
}: {
  projectName?: string;
  sheets?: Sheet[];
  canEdit?: boolean;
}) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [linkFilter, setLinkFilter] = useState<LinkFilter>("전체");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    listPhotos(projectName)
      .then(setPhotos)
      .catch((e) => setError(e instanceof Error ? e.message : "사진 조회 실패"));
  }, [projectName]);

  useEffect(() => {
    load();
  }, [load]);

  const sheetName = useCallback(
    (sheetId: string | null) => {
      if (!sheetId) return null;
      const s = sheets.find((sh) => sh.id === sheetId);
      return s ? `${s.number} · ${s.title}` : sheetId;
    },
    [sheets]
  );

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return photos.filter(
      (p) =>
        (linkFilter === "전체" ||
          (linkFilter === "연결" && p.sheet_id) ||
          (linkFilter === "미연결" && !p.sheet_id)) &&
        (!normalized ||
          p.title.toLowerCase().includes(normalized) ||
          p.caption.toLowerCase().includes(normalized))
    );
  }, [photos, linkFilter, query]);

  const selected = photos.find((p) => p.photo_id === selectedId) ?? null;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const created = await uploadPhoto({ file, projectName });
        setPhotos((prev) => [created, ...prev]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "사진 업로드 실패");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function patch(id: string, body: { caption?: string; sheet_id?: string | null }) {
    try {
      const updated = await updatePhoto(id, body);
      setPhotos((prev) => prev.map((p) => (p.photo_id === id ? updated : p)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "사진 수정 실패");
    }
  }

  async function remove(id: string) {
    try {
      await apiDeletePhoto(id);
      setPhotos((prev) => prev.filter((p) => p.photo_id !== id));
      setSelectedId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "사진 삭제 실패");
    }
  }

  const linkedCount = photos.filter((p) => p.sheet_id).length;

  return (
    <section className="build-page" aria-labelledby="photos-title">
      <div className="build-page-heading">
        <div>
          <h1 id="photos-title">사진</h1>
          <p>현장·검수 사진 갤러리 · 전체 {photos.length}장 / 시트 연결 {linkedCount}장</p>
        </div>
        <button
          className="primary-action"
          type="button"
          disabled={!canEdit || busy}
          title={canEdit ? undefined : "사진 업로드 권한이 없습니다(뷰어)"}
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={16} aria-hidden="true" />
          {busy ? "업로드 중..." : "사진 추가"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          aria-hidden="true"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error ? <div className="viewer-op-error" role="alert">{error}</div> : null}

      <div className="sheets-toolbar">
        {(["전체", "연결", "미연결"] as LinkFilter[]).map((f) => (
          <button
            key={f}
            className="secondary-action"
            type="button"
            aria-pressed={linkFilter === f}
            onClick={() => setLinkFilter(f)}
          >
            {f === "전체" ? "전체" : f === "연결" ? "시트 연결" : "미연결"}
          </button>
        ))}
        <label className="search-field sheets-search">
          <Search size={18} aria-hidden="true" />
          <input
            aria-label="사진 검색"
            name="photo-search"
            placeholder="제목·설명 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="photo-empty" role="status">
          <span className="build-table-empty-icon" aria-hidden="true">
            <ImageIcon size={24} />
          </span>
          <strong>{photos.length === 0 ? "갤러리 비어 있음" : "조건에 맞는 사진이 없습니다."}</strong>
          <span>
            {photos.length === 0
              ? canEdit
                ? "‘사진 추가’로 현장 사진을 업로드하세요."
                : "업로드된 사진이 없습니다."
              : "필터·검색 조건을 변경하세요."}
          </span>
        </div>
      ) : (
        <ul className="photo-grid" aria-label="사진 갤러리">
          {visible.map((photo) => (
            <li key={photo.photo_id}>
              <button
                type="button"
                className="photo-card"
                onClick={() => setSelectedId(photo.photo_id)}
                aria-label={`${photo.title} 크게 보기`}
              >
                <img src={photoSrc(photo)} alt={photo.title} loading="lazy" />
                <span className="photo-card-meta">
                  <strong>{photo.title}</strong>
                  {photo.sheet_id ? (
                    <span className="photo-link-badge">
                      <Link2 size={12} aria-hidden="true" /> {sheetName(photo.sheet_id)}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected ? (
        <PhotoLightbox
          photo={selected}
          sheets={sheets}
          sheetName={sheetName}
          canEdit={canEdit}
          onClose={() => setSelectedId(null)}
          onPatch={(body) => patch(selected.photo_id, body)}
          onDelete={() => remove(selected.photo_id)}
        />
      ) : null}
    </section>
  );
}

function PhotoLightbox({
  photo,
  sheets,
  sheetName,
  canEdit,
  onClose,
  onPatch,
  onDelete
}: {
  photo: Photo;
  sheets: Sheet[];
  sheetName: (id: string | null) => string | null;
  canEdit: boolean;
  onClose: () => void;
  onPatch: (body: { caption?: string; sheet_id?: string | null }) => void;
  onDelete: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalDismiss(onClose, dialogRef);
  const [caption, setCaption] = useState(photo.caption);

  return (
    <div className="modal-backdrop">
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="photo-lightbox"
        role="dialog"
        aria-modal="true"
        aria-label={`사진: ${photo.title}`}
      >
        <button className="modal-close" type="button" aria-label="닫기" onClick={onClose}>
          <X size={22} />
        </button>
        <div className="photo-lightbox-image">
          <img src={photoSrc(photo)} alt={photo.title} />
        </div>
        <div className="photo-lightbox-side">
          <h2>{photo.title}</h2>
          <dl>
            <div>
              <dt>업로드</dt>
              <dd>{photo.uploaded_by || "미상"}</dd>
            </div>
            <div>
              <dt>파일</dt>
              <dd>{photo.filename}</dd>
            </div>
            <div>
              <dt>연결 시트</dt>
              <dd>{sheetName(photo.sheet_id) ?? "없음"}</dd>
            </div>
          </dl>

          <label className="field">
            <span>설명</span>
            <textarea
              name="photo-caption"
              rows={3}
              value={caption}
              disabled={!canEdit}
              placeholder="사진 설명"
              onChange={(e) => setCaption(e.target.value)}
              onBlur={() => {
                if (canEdit && caption !== photo.caption) onPatch({ caption });
              }}
            />
          </label>

          <label className="field select-field">
            <span>시트 연결</span>
            <select
              name="photo-sheet"
              aria-label="연결 시트"
              value={photo.sheet_id ?? ""}
              disabled={!canEdit}
              title={canEdit ? undefined : "연결 변경 권한이 없습니다(뷰어)"}
              onChange={(e) => onPatch({ sheet_id: e.target.value || null })}
            >
              <option value="">연결 없음</option>
              {sheets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.number} · {s.title}
                </option>
              ))}
            </select>
          </label>

          {canEdit ? (
            <button type="button" className="ghost-action issue-delete" onClick={onDelete}>
              <Trash2 size={15} aria-hidden="true" /> 사진 삭제
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
