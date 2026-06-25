# PROGRESS — 실동작 빌드아웃 루프

> 매 재진입 시 `LOOP.md` → `PLAN.md` → 이 파일 순으로 읽고 이어받는다.

## 현재 상태 (2026-06-25, 세션 2 — S1 walking skeleton 동작 완료)

- **단계**: **S1 업로드→변환→뷰어 walking skeleton 동작 완료.** 실 dwg/pdf 업로드→변환→뷰어 실 도면 렌더 end-to-end 입증. `npm run build` PASS · `npm test` **54 PASS** · backend `pytest` **2 PASS** · 브라우저 콘솔 0 · `git diff --check` clean. 메타프롬프트 A1~A8 전부 MET(증거 `EVIDENCE.md`). **미커밋.**
- **S1 구현 요약**: `backend/`(FastAPI+DrawingStore 추상화+ODA/ezdxf/PyMuPDF 변환, Study_TypeDB 이식·런타임 비의존) + 프론트(`src/api/drawings.ts`·FilesView 실업로드·MarkupCanvas 실PNG·Sheet.imageUrl).
- **남은 위험**: TypeDB는 Docker 미기동+드라이버 API 불일치로 **JSON store 폴백 중**(store 추상화로 무중단 전환 가능, Docker 활성화는 후속). 나머지 2엔진(오픈소스·APS) 충실화 = S1.5. 독립 검증팀(full loop) 미실행.

### 세션 1 (계획 수립)
- 루프 **계획 수립 완료, S1 메타프롬프트 FROZEN**.
- **확정된 4결정**(`LOOP.md` Frozen decisions):
  1. 목표 = ACC 실기능 전체 구현(외관은 appearance-loop DONE).
  2. 백엔드 = xd 소유 독립 로컬 풀스택(Study_TypeDB 코드 이식, 런타임 비의존).
  3. 도면 렌더 = 하이브리드·오픈소스·APS 3-way bake-off 비교.
  4. 첫 슬라이스 = S1 업로드→변환→뷰어.
- **선행 근거**:
  - 현 앱 = 100% 정적 외관(의존성에 dxf/dwg/pdf/three 없음, `type=file`+FileReader 없음, viewerData 주석 "실제 드로잉/영속/연산 없음").
  - `Study_TypeDB`(`D:\_Project\Study_TypeDB`) = 동작 백엔드(FastAPI+TypeDB 3.7.3+ezdxf, 250 test PASS). 도면 API/서비스/온톨로지(`04-drawings.tql`)가 S1과 거의 일치 → **이식 소스**.
  - 변환 도구체인 검증됨: ODA File Converter(설치), ezdxf, PyMuPDF(fitz), matplotlib, Pillow.
  - 테스트 도면: `D:\_Project` 전역 dwg 822·pdf 901·dxf 25. xd 레포 내 `reference/old-prototypes/.../dwg/`에 다분야 도면.

## 다음 작업 (S1) — 메타프롬프트 FROZEN, 구현 진입 준비됨

- **S1 freeze 답**: ①완료범위=1엔진 end-to-end+비교초안(나머지 2엔진=S1.5) ②TypeDB=Docker(3.7.3) ③테스트도면=elec-sld.dwg + 청주 EE-01-006 단선도 PDF.
1. ai-loop 스킬 장착하여 S1 구현 착수: 백엔드 부트스트랩(FastAPI+TypeDB Docker) → Study_TypeDB 도면처리 이식 → 업로드 → 변환(ezdxf/ODA) → 시트 PNG → 뷰어 1엔진 렌더.
2. 별도 검증팀이 S1 Acceptance A1~A8 채점.

## 미해결 / 메모

- 외관 17화면 브라우저 스크린샷 전수 점검은 fork가 미완(audit 폴더 빈 상태). 외관 자체는 appearance-loop에서 DONE·52 test PASS·전 항목 MET로 검증됨. 사용자가 원하면 직접 재점검 가능.
- 마일스톤 체크리스트는 `PLAN.md` 참조. S1만 메타프롬프트 작성, S2~S8은 해당 마일스톤 진입 시 작성.
