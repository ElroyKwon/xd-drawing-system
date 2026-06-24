export type FileFolderRow = {
  id: string;
  name: string;
  indent?: boolean;
  updatedAt: string;
  updatedBy: string;
};

// 캡처(180047) 좌측 폴더 트리 = 테이블 본문 폴더 행. 값은 대부분 "--"(빈 폴더), 수정일/수정자만 mock.
export const fileFolders: FileFolderRow[] = [
  { id: "bids", name: "Bids", updatedAt: "2026년 6월 12일", updatedBy: "Forma Sample" },
  { id: "contractors", name: "Contractors", updatedAt: "2026년 6월 12일", updatedBy: "Forma Sample" },
  { id: "coordination", name: "Coordination", updatedAt: "2026년 6월 12일", updatedBy: "Forma Sample" },
  { id: "correspondence", name: "Correspondence", updatedAt: "2026년 6월 12일", updatedBy: "Forma Sample" },
  { id: "crystal-clear-glazing", name: "Crystal Clear Glazing", updatedAt: "2026년 6월 12일", updatedBy: "Forma Sample" },
  { id: "delta-engineers", name: "Delta Engineers", updatedAt: "2026년 6월 12일", updatedBy: "Forma Sample" },
  { id: "drawings", name: "Drawings", updatedAt: "2026년 6월 12일", updatedBy: "Forma 시스템" },
  { id: "for-the-field", name: "For the Field", updatedAt: "2026년 6월 12일", updatedBy: "Forma Sample" },
  { id: "handover-documents", name: "Handover documents", updatedAt: "2026년 6월 12일", updatedBy: "Forma Sample" },
  { id: "quantity-models", name: "Quantity models", updatedAt: "2026년 6월 12일", updatedBy: "Forma Sample" },
  { id: "supported-files", name: "Supported files", updatedAt: "2026년 6월 12일", updatedBy: "Forma Sample" }
];
