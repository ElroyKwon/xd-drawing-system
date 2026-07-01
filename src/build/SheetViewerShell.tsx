import { ArrowLeft, Download, Grid2X2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Sheet } from "../buildSheetsData";
import {
  createIssue,
  createMarkup,
  createMeasurement,
  deleteIssue as apiDeleteIssue,
  deleteMarkup as apiDeleteMarkup,
  deleteMeasurement as apiDeleteMeasurement,
  issueCategoryCounts,
  listIssues,
  listMarkups,
  listMeasurements,
  sheetImageUrl,
  updateIssue,
  updateMarkup,
  type Drawing,
  type Issue,
  type IssueStatus,
  type Markup,
  type Measurement,
  type VectorUnits
} from "../api/drawings";
import CalibrationModal from "./viewer/CalibrationModal";
import CompareModal from "./viewer/CompareModal";
import CompareOverlay from "./viewer/CompareOverlay";
import IssueAddPanel from "./viewer/IssueAddPanel";
import IssueCreateForm from "./viewer/IssueCreateForm";
import IssueDetailPanel from "./viewer/IssueDetailPanel";
import MarkupCanvas from "./viewer/MarkupCanvas";
import MarkupListPanel from "./viewer/MarkupListPanel";
import MarkupPropertyPanel from "./viewer/MarkupPropertyPanel";
import MarkupToolRail from "./viewer/MarkupToolRail";
import MeasurePanel from "./viewer/MeasurePanel";
import VectorCanvas from "./viewer/VectorCanvas";
import {
  issueCategories,
  measureTypes,
  type MarkupTool,
  type MeasureType,
  type ViewerLeftTab
} from "./viewer/viewerData";

const leftTabs: ViewerLeftTab[] = ["마크업", "마크업 로그", "이슈"];
type Pt = [number, number];

export default function SheetViewerShell({
  projectName,
  selectedSheet,
  sheets,
  canEdit = true,
  focusIssueId = null,
  focusPin = null,
  onBack
}: {
  projectName: string;
  selectedSheet: Sheet;
  sheets: Sheet[];
  // J7: 뷰어는 마크업/측정/이슈 작성·수정·삭제 불가(서버 403과 일관). 조회·팬/줌·비교는 허용.
  canEdit?: boolean;
  focusIssueId?: string | null;
  focusPin?: Pt | null;
  onBack: () => void;
}) {
  const [activeTool, setActiveTool] = useState<MarkupTool>("선택");
  const [leftTab, setLeftTab] = useState<ViewerLeftTab>("마크업");
  const [selectedMarkupId, setSelectedMarkupId] = useState<string | null>(null);
  const [selectedIssueCategory, setSelectedIssueCategory] = useState<string | null>(null);
  const [measureOpen, setMeasureOpen] = useState(false);
  const [activeMeasureType, setActiveMeasureType] = useState<MeasureType>("선형");
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareAgainst, setCompareAgainst] = useState<Drawing | null>(null);
  const [units, setUnits] = useState<VectorUnits | undefined>(undefined);

  const [markups, setMarkups] = useState<Markup[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [pendingPin, setPendingPin] = useState<{ point: Pt; coord_space: "world" | "image" } | null>(null);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [opError, setOpError] = useState<string | null>(null);

  const fileId = selectedSheet.fileId;
  const sheetId = selectedSheet.id;
  const sheetIndex = selectedSheet.sheetIndex ?? 0;

  const refreshCounts = useCallback(() => {
    issueCategoryCounts(projectName).then(setCategoryCounts).catch(() => {/* 집계 실패 무시 */});
  }, [projectName]);

  // S1.5: ②벡터(승자) ↔ ①래스터 토글. DWG/DXF만 벡터 가용.
  const vectorCapable = Boolean(fileId) && selectedSheet.source !== "pdf-page";
  const [renderEngine, setRenderEngine] = useState<"vector" | "raster">(vectorCapable ? "vector" : "raster");
  const showVector = vectorCapable && renderEngine === "vector";

  // 시트가 바뀌면 마크업/측정/이슈 로드(새로고침·재진입 복원 = E2/E6/H5).
  useEffect(() => {
    setSelectedMarkupId(null);
    setSelectedIssueId(null);
    setPendingPin(null);
    setMeasureOpen(false);
    setMarkups([]);
    setMeasurements([]);
    setIssues([]);
    refreshCounts();
    if (!fileId) return;
    let alive = true;
    Promise.all([listMarkups(fileId, sheetId), listMeasurements(fileId, sheetId), listIssues({ fileId, sheetId })])
      .then(([m, ms, iss]) => {
        if (!alive) return;
        setMarkups(m);
        setMeasurements(ms);
        setIssues(iss);
      })
      .catch(() => {/* 로드 실패는 빈 상태 유지 */});
    return () => {
      alive = false;
    };
  }, [fileId, sheetId, refreshCounts]);

  // 딥링크: 목록에서 핀 있는 이슈로 점프하면 이슈 탭+선택 활성(좌표 센터링은 VectorCanvas focusPin).
  // focusIssueId당 1회만 적용 — 이후 issues 변경(상태변경·새 핀 작성)이 선택을 되돌리지 않도록 가드.
  const appliedFocusRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      focusIssueId &&
      focusIssueId !== appliedFocusRef.current &&
      issues.some((i) => i.issue_id === focusIssueId)
    ) {
      appliedFocusRef.current = focusIssueId;
      setSelectedIssueId(focusIssueId);
      setLeftTab("이슈");
    }
  }, [focusIssueId, issues]);

  // DXF=world, PDF/래스터=image 좌표계로 마크업/핀을 분리해 해당 캔버스에만 렌더한다.
  const coordSpace: "world" | "image" = showVector ? "world" : "image";
  const visibleMarkups = markups.filter((m) => m.coord_space === coordSpace);
  const visibleIssues = issues.filter((i) => !i.pin || i.pin.coord_space === coordSpace);
  const selectedMarkup = markups.find((m) => m.markup_id === selectedMarkupId) ?? null;
  const selectedIssue = issues.find((i) => i.issue_id === selectedIssueId) ?? null;
  const compareResultOpen = Boolean(compareAgainst);
  const hasAside =
    !compareResultOpen &&
    (measureOpen || Boolean(selectedMarkup) || Boolean(pendingPin) || Boolean(selectedIssue));
  const pinCoordLabel = pendingPin
    ? pendingPin.coord_space === "world"
      ? `도면 좌표 (${pendingPin.point[0].toFixed(1)}, ${pendingPin.point[1].toFixed(1)})`
      : `정규화 (${pendingPin.point[0].toFixed(2)}, ${pendingPin.point[1].toFixed(2)})`
    : "";

  const commitMarkup = useCallback(
    async (m: { kind: string; geometry: Pt[]; text?: string; color: string }) => {
      if (!canEdit || !fileId) return;
      try {
        const created = await createMarkup(fileId, {
          sheet_id: sheetId,
          kind: m.kind,
          coord_space: coordSpace,
          geometry: m.geometry,
          style: { color: m.color, width: 2 },
          text: m.text ?? ""
        });
        setMarkups((prev) => [...prev, created]);
        setOpError(null);
      } catch (e) {
        setOpError(e instanceof Error ? e.message : "마크업 저장 실패");
      }
    },
    [canEdit, fileId, sheetId, coordSpace]
  );

  const commitMeasurement = useCallback(
    async (m: { type: MeasureType; geometry: Pt[]; value: number; unit: string }) => {
      if (!canEdit || !fileId) return;
      try {
        const created = await createMeasurement(fileId, {
          sheet_id: sheetId,
          type: m.type,
          geometry: m.geometry,
          value: m.value,
          unit: m.unit
        });
        setMeasurements((prev) => [...prev, created]);
        setOpError(null);
      } catch (e) {
        setOpError(e instanceof Error ? e.message : "측정 저장 실패");
      }
    },
    [canEdit, fileId, sheetId]
  );

  async function removeMarkup(id: string) {
    if (!fileId) return;
    try {
      await apiDeleteMarkup(fileId, id);
      setMarkups((prev) => prev.filter((m) => m.markup_id !== id));
      setSelectedMarkupId(null);
    } catch (e) {
      setOpError(e instanceof Error ? e.message : "마크업 삭제 실패");
    }
  }

  async function changeMarkup(id: string, patch: { text?: string; style?: Markup["style"] }) {
    if (!fileId) return;
    try {
      const updated = await updateMarkup(fileId, id, patch);
      setMarkups((prev) => prev.map((m) => (m.markup_id === id ? updated : m)));
    } catch (e) {
      setOpError(e instanceof Error ? e.message : "마크업 수정 실패");
    }
  }

  async function removeMeasurement(id: string) {
    if (!fileId) return;
    try {
      await apiDeleteMeasurement(fileId, id);
      setMeasurements((prev) => prev.filter((m) => m.measurement_id !== id));
    } catch (e) {
      setOpError(e instanceof Error ? e.message : "측정 삭제 실패");
    }
  }

  // 이슈 핀 도구로 캔버스를 클릭하면 핀 위치를 확정하고 작성 폼을 연다.
  const placePin = useCallback((point: Pt) => {
    if (!canEdit) return;
    setSelectedMarkupId(null);
    setSelectedIssueId(null);
    setMeasureOpen(false);
    setPendingPin({ point, coord_space: coordSpace });
  }, [canEdit, coordSpace]);

  async function createIssueFromPin(input: { title: string; type: string; category: string; assignee: string }) {
    if (!canEdit || !pendingPin || !fileId) return;
    try {
      const created = await createIssue({
        title: input.title,
        type: input.type,
        category: input.category,
        assignee: input.assignee,
        projectName,
        fileId,
        sheetId,
        pin: { point: pendingPin.point, coord_space: pendingPin.coord_space }
      });
      setIssues((prev) => [created, ...prev]);
      setPendingPin(null);
      setSelectedIssueId(created.issue_id);
      setActiveTool("선택");
      refreshCounts();
      setOpError(null);
    } catch (e) {
      setOpError(e instanceof Error ? e.message : "이슈 작성 실패");
    }
  }

  async function changeIssueStatus(id: string, status: IssueStatus) {
    try {
      const updated = await updateIssue(id, { status });
      setIssues((prev) => prev.map((i) => (i.issue_id === id ? updated : i)));
      refreshCounts();
      setOpError(null);
    } catch (e) {
      setOpError(e instanceof Error ? e.message : "이슈 상태 변경 실패");
    }
  }

  async function removeIssue(id: string) {
    try {
      await apiDeleteIssue(id);
      // soft delete → 시트 목록에서 숨김(기본 목록은 삭제됨 제외).
      setIssues((prev) => prev.filter((i) => i.issue_id !== id));
      setSelectedIssueId(null);
      refreshCounts();
    } catch (e) {
      setOpError(e instanceof Error ? e.message : "이슈 삭제 실패");
    }
  }

  function selectIssue(id: string | null) {
    setSelectedIssueId(id);
    if (id) {
      setSelectedMarkupId(null);
      setMeasureOpen(false);
      setPendingPin(null);
    }
  }

  function selectTool(tool: MarkupTool) {
    // 렌즈2 MAJOR-1: 캔버스 드로잉은 activeTool로만 열린다. 툴레일 disabled에 더해
    // 여기서도 뷰어의 작성 도구 진입을 차단(방어심화 — 미래 단축키/프리셋 fail-open 예방).
    if (!canEdit && tool !== "선택") return;
    setActiveTool(tool);
    setPendingPin(null);
    if (tool === "측정") {
      setSelectedMarkupId(null);
      setSelectedIssueId(null);
      setMeasureOpen(true);
    } else {
      setMeasureOpen(false);
      if (tool !== "선택") {
        setSelectedMarkupId(null);
        setSelectedIssueId(null);
      }
    }
  }

  function closeMeasure() {
    setMeasureOpen(false);
    setActiveTool("선택");
  }

  function selectMarkup(id: string | null) {
    setSelectedMarkupId(id);
    if (id) setMeasureOpen(false);
  }

  function startCompare(against: Drawing) {
    setSelectedMarkupId(null);
    setMeasureOpen(false);
    setActiveTool("선택");
    setCompareOpen(false);
    setCompareAgainst(against);
  }

  const compareBSheet = compareAgainst ? compareAgainst.sheets[sheetIndex] ?? compareAgainst.sheets[0] : null;

  return (
    <section className="viewer-shell" aria-label="2D 시트 뷰어">
      <header className="viewer-header">
        <button className="ghost-action" type="button" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          시트 목록
        </button>
        <div>
          <h1>{selectedSheet.number}</h1>
          <p>{selectedSheet.title}</p>
          <span>{projectName}</span>
        </div>
        <div className="viewer-header-actions">
          {fileId ? (
            <button className="secondary-action" type="button" onClick={() => setCompareOpen(true)}>
              <Grid2X2 size={16} aria-hidden="true" />
              시트 비교
            </button>
          ) : null}
          <button className="secondary-action" type="button">
            <Download size={16} aria-hidden="true" />
            내보내기
          </button>
        </div>
      </header>

      {opError ? (
        <div className="viewer-op-error" role="alert">
          {opError}
        </div>
      ) : null}

      <div className={`viewer-grid${hasAside ? " has-aside" : ""}`}>
        <aside className="viewer-panel">
          <div className="viewer-panel-tabs" role="tablist" aria-label="뷰어 패널">
            {leftTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={leftTab === tab}
                onClick={() => setLeftTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          {leftTab === "이슈" ? (
            <IssueAddPanel
              categories={issueCategories}
              counts={categoryCounts}
              selectedCategoryId={selectedIssueCategory}
              onSelectCategory={(id) => setSelectedIssueCategory((current) => (current === id ? null : id))}
              issues={visibleIssues}
              selectedIssueId={selectedIssueId}
              onSelectIssue={selectIssue}
            />
          ) : (
            <MarkupListPanel
              markups={visibleMarkups}
              selectedMarkupId={selectedMarkupId}
              isLog={leftTab === "마크업 로그"}
              onSelectMarkup={selectMarkup}
            />
          )}
        </aside>

        <div className="viewer-stage">
          {compareResultOpen && compareAgainst && fileId ? (
            <CompareOverlay
              aLabel={`v${selectedSheet.version}`}
              bLabel={`v${compareAgainst.version}`}
              aUrl={selectedSheet.imageUrl}
              bUrl={compareBSheet ? sheetImageUrl(compareBSheet) : undefined}
              fileId={fileId}
              againstId={compareAgainst.file_id}
              sheetIndex={sheetIndex}
              onClose={() => setCompareAgainst(null)}
            />
          ) : (
            <>
              {vectorCapable ? (
                <div className="render-engine-toggle" role="group" aria-label="렌더 엔진">
                  <button type="button" aria-pressed={renderEngine === "vector"} onClick={() => setRenderEngine("vector")}>
                    벡터
                  </button>
                  <button type="button" aria-pressed={renderEngine === "raster"} onClick={() => setRenderEngine("raster")}>
                    래스터
                  </button>
                </div>
              ) : null}
              {showVector ? (
                <VectorCanvas
                  fileId={fileId as string}
                  activeTool={activeTool}
                  markups={visibleMarkups}
                  measurements={measurements}
                  issues={visibleIssues}
                  measureType={activeMeasureType}
                  selectedMarkupId={selectedMarkupId}
                  selectedIssueId={selectedIssueId}
                  focusPin={focusPin}
                  onSelectMarkup={selectMarkup}
                  onSelectIssue={selectIssue}
                  onPlacePin={placePin}
                  onCommitMarkup={commitMarkup}
                  onCommitMeasurement={commitMeasurement}
                  onUnits={setUnits}
                />
              ) : (
                <MarkupCanvas
                  selectedSheet={selectedSheet}
                  markups={visibleMarkups}
                  issues={visibleIssues}
                  activeTool={activeTool}
                  selectedMarkupId={selectedMarkupId}
                  selectedIssueId={selectedIssueId}
                  onSelectMarkup={selectMarkup}
                  onSelectIssue={selectIssue}
                  onPlacePin={placePin}
                  onCommitMarkup={commitMarkup}
                />
              )}
            </>
          )}
        </div>

        {hasAside &&
          (pendingPin ? (
            <IssueCreateForm
              coordLabel={pinCoordLabel}
              categories={issueCategories}
              defaultCategoryId={selectedIssueCategory}
              onSubmit={createIssueFromPin}
              onCancel={() => setPendingPin(null)}
            />
          ) : selectedIssue ? (
            <IssueDetailPanel
              issue={selectedIssue}
              canEdit={canEdit}
              onChangeStatus={(status) => changeIssueStatus(selectedIssue.issue_id, status)}
              onDelete={() => removeIssue(selectedIssue.issue_id)}
              onClose={() => setSelectedIssueId(null)}
            />
          ) : measureOpen ? (
            <MeasurePanel
              measureTypes={measureTypes}
              activeMeasureType={activeMeasureType}
              measurements={measurements}
              units={units}
              enabled={showVector}
              canEdit={canEdit}
              disabledReason={
                vectorCapable ? "래스터 엔진에서는 측정할 수 없습니다. 벡터로 전환하세요." : "측정은 DXF 벡터 시트 전용입니다(PDF 제외)."
              }
              onSelectMeasureType={setActiveMeasureType}
              onDeleteMeasurement={removeMeasurement}
              onCalibrate={() => setCalibrationOpen(true)}
              onClose={closeMeasure}
            />
          ) : selectedMarkup ? (
            <MarkupPropertyPanel
              markup={selectedMarkup}
              canEdit={canEdit}
              onClose={() => setSelectedMarkupId(null)}
              onChange={(patch) => changeMarkup(selectedMarkup.markup_id, patch)}
              onDelete={() => removeMarkup(selectedMarkup.markup_id)}
            />
          ) : null)}

        <MarkupToolRail activeTool={activeTool} onSelectTool={selectTool} canEdit={canEdit} />
      </div>

      <footer className="sheet-filmstrip" aria-label="필름스트립">
        <strong>필름스트립</strong>
        <div>
          {sheets.map((sheet) => (
            <button key={sheet.id} type="button" aria-current={sheet.id === selectedSheet.id ? "page" : undefined}>
              {sheet.number}
            </button>
          ))}
        </div>
      </footer>

      {calibrationOpen && (
        <CalibrationModal units={units} onClose={() => setCalibrationOpen(false)} onConfirm={() => setCalibrationOpen(false)} />
      )}
      {compareOpen && (
        <CompareModal currentSheet={selectedSheet} onClose={() => setCompareOpen(false)} onCompare={startCompare} />
      )}
    </section>
  );
}
