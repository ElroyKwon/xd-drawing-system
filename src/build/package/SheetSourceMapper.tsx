import { CheckCircle2, FileText, Layers, Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { fileUrl } from "../../api/drawings";
import {
  getPackage, getPackageHints, listProjectSheetSources, publishPackage, savePackageMapping,
  type DwgLink, type HintMap, type PackageDetail, type PublishResult, type SheetSourceLink,
} from "../../api/packages";
import { assignDwg, isMapped, mappingSummary, removeDwg, setInheritKey, type Mapping } from "./mappingState";
import "./package.css";

const MAX_POLLS = 12;

export default function SheetSourceMapper({
  packageId,
  onClose,
  onPublished,
}: {
  packageId: string;
  onClose: () => void;
  onPublished?: () => void;
}) {
  const [detail, setDetail] = useState<PackageDetail | null>(null);
  const [hints, setHints] = useState<HintMap>({});
  const [mapping, setMapping] = useState<Mapping>({});
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);
  // 계승 후보(같은 프로젝트의 현행 sheet_source). Phase 1엔 보통 비어 있음.
  const [inheritCandidates, setInheritCandidates] = useState<SheetSourceLink[]>([]);
  const [pollsExhausted, setPollsExhausted] = useState(false);
  const loadedRef = useRef(false);   // MINOR-2: 첫 로드 전 저장이 draft를 빈값으로 덮어쓰지 않도록 가드
  const pollsRef = useRef(0);

  const load = useCallback(async () => {
    try {
      const d = await getPackage(packageId);
      setDetail(d);
      // draft_mapping은 첫 로드 시 1회만 복원(이후 사용자 편집 보존).
      if (!loadedRef.current) setMapping({ ...d.draft_mapping });
      loadedRef.current = true;
      setError(null);
      return d;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return null;
    }
  }, [packageId]);

  useEffect(() => {
    void load().then((d) => {
      if (d) listProjectSheetSources(d.project_name).then(setInheritCandidates).catch(() => {});
    });
    getPackageHints(packageId).then(setHints).catch(() => {/* 힌트 실패 무시 */});
  }, [load, packageId]);

  // 업로드 직후 변환 진행 중이면 시트/레이아웃이 아직 없을 수 있다 → 제한 폴링.
  // PDF 시트뿐 아니라 DWG 레이아웃도 기다린다(변환 완료 시점이 파일마다 다름).
  useEffect(() => {
    if (!detail || result) return;
    if (!isConverting(detail)) return;
    if (pollsRef.current >= MAX_POLLS) { setPollsExhausted(true); return; }
    const t = setTimeout(() => {
      pollsRef.current += 1;
      void load().then(() => getPackageHints(packageId).then(setHints).catch(() => {}));
    }, 2000);
    return () => clearTimeout(t);
  }, [detail, result, load, packageId]);

  function manualRefresh() {
    // MINOR-1: 변환이 폴링 한도를 넘겨도 수동 새로고침으로 복구 가능.
    pollsRef.current = 0;
    setPollsExhausted(false);
    void load().then(() => getPackageHints(packageId).then(setHints).catch(() => {}));
  }

  function doAssign(sheetId: string, link: DwgLink) {
    const sheet = detail?.pdf_sheets.find((s) => s.sheet_id === sheetId);
    if (!sheet) return;
    setMapping((m) => assignDwg(m, sheet, link));
  }

  async function handleSaveDraft() {
    if (!loadedRef.current) return;   // MINOR-2: 첫 로드 완료 전 저장 금지(빈값 덮어쓰기 방지)
    setBusy(true);
    try {
      await savePackageMapping(packageId, mapping);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish() {
    if (!loadedRef.current) return;
    setBusy(true);
    try {
      await savePackageMapping(packageId, mapping);   // 발행 전 최신 매핑 확정
      const res = await publishPackage(packageId);
      setResult(res);
      onPublished?.();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const summary = detail ? mappingSummary(detail.pdf_sheets, detail.dwgs, mapping) : null;
  const converting = detail ? isConverting(detail) : false;

  return (
    <div className="modal-backdrop">
      <div className="project-modal pkg-mapper" role="dialog" aria-modal="true" aria-labelledby="pkg-mapper-title">
        <header className="modal-header">
          <h2 id="pkg-mapper-title">시트 ↔ 소스 DWG 매핑{detail ? ` — ${detail.title}` : ""}</h2>
          <button className="modal-close" type="button" aria-label="닫기" onClick={onClose}><X size={22} /></button>
        </header>

        {error ? <p className="upload-error" role="alert">{error}</p> : null}

        {result ? (
          <div className="pkg-publish-summary" role="status">
            <CheckCircle2 size={40} aria-hidden="true" />
            <h3>발행 완료</h3>
            <p>
              발행 링크 <strong>{result.published}</strong> · 미매핑 시트 <strong>{result.unmapped_sheets.length}</strong> ·
              미링크 DWG <strong>{result.unlinked_dwgs.length}</strong>
            </p>
            <p className="pkg-hint-text">각 시트에 sheet_key·리비전이 확정되었습니다. 시트 상세에서 "소스 DWG 열기"로 왕래할 수 있습니다.</p>
            <button className="primary-action" type="button" onClick={onClose}>닫기</button>
          </div>
        ) : (
          <>
            {summary ? (
              <div className="pkg-mapper-status" aria-live="polite">
                매핑됨 <strong>{summary.mappedCount}</strong> / 전체 {detail?.pdf_sheets.length ?? 0} 시트
                {summary.unlinkedDwgIds.length > 0 ? ` · 미링크 DWG ${summary.unlinkedDwgIds.length}` : ""}
              </div>
            ) : null}

            <div className="pkg-mapper-body">
              {/* 좌: PDF 시트 카드 */}
              <div className="pkg-col pkg-sheets" aria-label="PDF 시트">
                <div className="pkg-col-head"><FileText size={15} aria-hidden="true" /> PDF 시트</div>
                {converting ? (
                  <div className="pkg-empty pkg-converting">
                    {pollsExhausted ? (
                      <>변환이 지연되고 있습니다. <button type="button" className="pkg-assign-btn" onClick={manualRefresh}>새로고침</button></>
                    ) : (
                      <><Loader2 size={18} className="spin" aria-hidden="true" /> 변환 중… 시트 추출을 기다립니다. <button type="button" className="pkg-assign-btn" onClick={manualRefresh}>새로고침</button></>
                    )}
                  </div>
                ) : detail && detail.pdf_sheets.length === 0 ? (
                  <div className="pkg-empty">발행 PDF가 없습니다. DWG만 업로드한 세트는 시트 경계가 없습니다(뷰어는 가능).</div>
                ) : (
                  detail?.pdf_sheets.map((sh) => {
                    const mapped = isMapped(mapping, sh.sheet_id);
                    const links = mapping[sh.sheet_id]?.dwg_links ?? [];
                    const sheetHints = hints[sh.sheet_id] ?? [];
                    return (
                      <div
                        key={sh.sheet_id}
                        className={`pkg-sheet-card${selectedSheetId === sh.sheet_id ? " selected" : ""}${mapped ? " mapped" : ""}`}
                        onDragOver={(e) => { e.preventDefault(); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          try {
                            const link = JSON.parse(e.dataTransfer.getData("application/json")) as DwgLink;
                            if (link?.dwg_file_id) doAssign(sh.sheet_id, link);
                          } catch {/* 잘못된 드롭 무시 */}
                        }}
                      >
                        <button
                          type="button"
                          className="pkg-sheet-select"
                          aria-pressed={selectedSheetId === sh.sheet_id}
                          onClick={() => setSelectedSheetId((c) => (c === sh.sheet_id ? null : sh.sheet_id))}
                        >
                          {sh.png_url ? (
                            <img src={fileUrl(sh.png_url)} alt="" className="pkg-thumb" />
                          ) : (
                            <span className="pkg-thumb pkg-thumb-empty" aria-hidden="true"><FileText size={20} /></span>
                          )}
                          <span className="pkg-sheet-meta">
                            <strong>{sh.sheet_number || sh.filename}</strong>
                            <span className={`pkg-badge ${mapped ? "pkg-badge-mapped" : "pkg-badge-loose"}`}>
                              {mapped ? "매핑됨" : "미매핑"}
                            </span>
                          </span>
                        </button>

                        {links.length > 0 ? (
                          <div className="pkg-links">
                            {links.map((l) => (
                              <span key={`${l.dwg_file_id}${l.layout_name ?? ""}`} className="pkg-link-chip">
                                {dwgLabel(detail, l)}
                                <button type="button" aria-label="연결 해제" onClick={() => setMapping((m) => removeDwg(m, sh.sheet_id, l))}>
                                  <X size={12} />
                                </button>
                              </span>
                            ))}
                          </div>
                        ) : null}

                        {mapped && inheritCandidates.length > 0 ? (
                          <label className="pkg-inherit">
                            <span>버전:</span>
                            <select
                              aria-label={`${sh.sheet_number || sh.filename} 시트 버전`}
                              value={mapping[sh.sheet_id]?.inherit_sheet_key ?? ""}
                              onChange={(e) => setMapping((m) => setInheritKey(m, sh.sheet_id, e.target.value || null))}
                            >
                              <option value="">신규 시트 (rev A)</option>
                              {inheritCandidates.map((c) => (
                                <option key={c.link_id} value={c.sheet_key}>
                                  계승: {c.sheet_number || c.sheet_key.slice(0, 10)} (현재 rev {c.rev})
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null}

                        {sheetHints.length > 0 && links.length === 0 ? (
                          <div className="pkg-hint-row">
                            <Sparkles size={13} aria-hidden="true" />
                            {sheetHints.map((h) => (
                              <button
                                key={`${h.dwg_file_id}${h.layout_name ?? ""}`}
                                type="button"
                                className="pkg-hint-chip"
                                title={h.reason}
                                onClick={() => doAssign(sh.sheet_id, { dwg_file_id: h.dwg_file_id, layout_name: h.layout_name })}
                              >
                                {h.layout_name ?? dwgFileLabel(detail, h.dwg_file_id)} · 제안
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>

              {/* 우: DWG 목록(레이아웃) */}
              <div className="pkg-col pkg-dwgs" aria-label="소스 DWG">
                <div className="pkg-col-head"><Layers size={15} aria-hidden="true" /> 소스 DWG</div>
                {detail && detail.dwgs.length === 0 ? (
                  <div className="pkg-empty">이 세트에 DWG/DXF가 없습니다.</div>
                ) : (
                  detail?.dwgs.map((d) => (
                    <div key={d.dwg_file_id} className="pkg-dwg">
                      <div className="pkg-dwg-name">{d.filename ?? d.dwg_file_id}</div>
                      {d.layouts.map((lay) => {
                        const link: DwgLink = { dwg_file_id: d.dwg_file_id, layout_name: lay.layout_name };
                        return (
                          <div
                            key={lay.sheet_id}
                            className="pkg-layout"
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData("application/json", JSON.stringify(link))}
                          >
                            <span>{lay.layout_name}</span>
                            <button
                              type="button"
                              className="pkg-assign-btn"
                              disabled={!selectedSheetId}
                              title={selectedSheetId ? "선택한 시트에 지정" : "먼저 왼쪽 시트를 선택하세요"}
                              onClick={() => selectedSheetId && doAssign(selectedSheetId, link)}
                            >
                              지정
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>

            <footer className="modal-footer pkg-mapper-footer">
              <span className="pkg-hint-text">
                드래그하거나, 시트를 선택한 뒤 DWG "지정" 버튼으로 연결합니다. 미매핑 시트는 그대로 발행할 수 있습니다(loose).
              </span>
              <div className="pkg-footer-actions">
                <button className="secondary-action" type="button" disabled={busy} onClick={() => void handleSaveDraft()}>
                  {busy ? <Loader2 size={14} className="spin" aria-hidden="true" /> : null} 임시 저장
                </button>
                <button className="primary-action" type="button" disabled={busy || (converting && !pollsExhausted)} onClick={() => void handlePublish()}>
                  발행
                </button>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

// 변환 진행 중 판정: 귀속된 PDF/DWG 중 아직 시트/레이아웃이 안 생긴 게 있으면 true.
function isConverting(detail: PackageDetail): boolean {
  const pendingPdf = detail.pdf_file_ids.length > 0 && detail.pdf_sheets.length === 0;
  const dwgLayouts = detail.dwgs.reduce((n, d) => n + d.layouts.length, 0);
  const pendingDwg = detail.dwg_file_ids.length > 0 && dwgLayouts === 0;
  return pendingPdf || pendingDwg;
}

function dwgFileLabel(detail: PackageDetail | null, fileId: string): string {
  return detail?.dwgs.find((d) => d.dwg_file_id === fileId)?.filename ?? fileId;
}

function dwgLabel(detail: PackageDetail | null, l: DwgLink): string {
  const file = dwgFileLabel(detail, l.dwg_file_id);
  return l.layout_name ? `${file} · ${l.layout_name}` : file;
}
