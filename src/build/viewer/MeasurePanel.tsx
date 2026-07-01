import { Trash2, X } from "lucide-react";
import type { Measurement, VectorUnits } from "../../api/drawings";
import type { MeasureType } from "./viewerData";

export default function MeasurePanel({
  measureTypes,
  activeMeasureType,
  measurements,
  units,
  enabled,
  disabledReason,
  canEdit = true,
  onSelectMeasureType,
  onDeleteMeasurement,
  onCalibrate,
  onClose
}: {
  measureTypes: MeasureType[];
  activeMeasureType: MeasureType;
  measurements: Measurement[];
  units?: VectorUnits;
  enabled: boolean;
  disabledReason?: string;
  // J7: 뷰어는 측정값 삭제 불가(조회만).
  canEdit?: boolean;
  onSelectMeasureType: (type: MeasureType) => void;
  onDeleteMeasurement: (id: string) => void;
  onCalibrate: () => void;
  onClose: () => void;
}) {
  const unitLabel = units
    ? units.to_meter != null
      ? `${units.name} (실척 자동)`
      : `${units.name} · 단위 미상`
    : "단위 확인 중";

  return (
    <aside className="viewer-aside" aria-label="측정 교정">
      <header className="viewer-aside-head">
        <div>
          <span className="viewer-aside-kicker">측정</span>
          <strong>실척 측정</strong>
        </div>
        <button type="button" className="icon-button" aria-label="측정 패널 닫기" onClick={onClose}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>

      {!enabled ? (
        <p className="viewer-empty" role="status">
          {disabledReason || "측정은 DXF 벡터 시트 전용입니다."}
        </p>
      ) : (
        <>
          <div className="measure-settings">
            <div className="measure-unit-readout">
              <span>도면 단위</span>
              <strong>{unitLabel}</strong>
            </div>
          </div>

          <div className="measure-types" role="group" aria-label="측정 타입">
            {measureTypes.map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={activeMeasureType === type}
                onClick={() => onSelectMeasureType(type)}
              >
                {type}
              </button>
            ))}
          </div>

          <p className="measure-hint">
            {activeMeasureType === "다각형 면적"
              ? "정점을 차례로 클릭하고 더블클릭으로 닫으면 면적이 계산됩니다."
              : "두 점을 드래그하면 실척 거리가 계산됩니다."}
          </p>

          {measurements.length === 0 ? (
            <p className="viewer-empty" role="status">
              아직 측정값이 없습니다.
            </p>
          ) : (
            <ul className="measure-rows" aria-label="측정값">
              {measurements.map((row, i) => (
                <li key={row.measurement_id}>
                  <span className="measure-marker">M{i + 1}</span>
                  <span className="measure-type-label">{row.type}</span>
                  <span className="measure-value">
                    {row.value.toFixed(2)} {row.unit}
                  </span>
                  {canEdit ? (
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`측정값 M${i + 1} 삭제`}
                      onClick={() => onDeleteMeasurement(row.measurement_id)}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <div className="measure-actions">
            <button type="button" className="secondary-action" onClick={onCalibrate}>
              단위 확인
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
