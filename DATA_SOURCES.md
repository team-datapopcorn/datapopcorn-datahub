# Data Sources — 마스터 리스트업 (Master List-up)

이 저장소는 한국 공공데이터포털(**data.go.kr**)의 데이터를 수집해
데이터 분석용 데이터허브(datahub)를 구성합니다. 대시보드 카탈로그(수집 목표
스키마)는 `data-hub/src/sampleData.js` 에 정의되어 있습니다. 수집기(collector)는
**한 번에 하나의 데이터 소스씩** 구축합니다. 이 문서는 그 진행 상황을 추적하는
마스터 리스트업입니다.

---

## Conventions (규칙)

- **New data.go.kr collectors** live in `collectors/` (Python), built on the shared
  client `collectors/datagokr_common.py`.
- **Outputs** go to `data/<source>.json` — a flat UTF-8 JSON array.
- Each source ships **3 artifacts**, matching the existing NEIS house style:
  1. collector script — `collectors/<source>.py`
  2. API guide — `collectors/<source>_GUIDE.md`
  3. n8n workflow — `collectors/<source>_workflow.json`
- **Auth**: the service key comes from the `DATA_GO_KR_SERVICE_KEY` env var
  (data.go.kr **Encoding key**). Each source's endpoint is configured via its own
  env var (e.g. `DATA_GO_KR_JEJU_GOLF_ENDPOINT`). **Every API needs its own
  활용신청 (per-API approval)** on data.go.kr. See `.env.example`.
- **Legacy note**: the original NEIS collectors (`fetch_schools.py`,
  `fetch_meals_paginated.sh`, `schools.json`, `meals_all_pages.json`) live at the
  **repo root** and use `open.neis.go.kr` with a `KEY` param — a **different portal**
  from data.go.kr. They predate the `collectors/` convention.

---

## Data source checklist

| Source | Dashboard key | data.go.kr dataset / API | Type | Status |
| :--- | :--- | :--- | :--- | :--- |
| 제주 골프장 | `jeju_golf_courses` | 15118920 전국 골프장 현황 (제주 필터) | file→odcloud | ✅ Done (this PR) |
| 울릉도 식당 | `ulleungdo_restaurants` | LOCALDATA 일반음식점 `opnSvcId=07_24_04_P` (울릉군 필터); data.go.kr 이관 2026-04, 표준데이터셋 15096283 | LOCALDATA / std | ⬜ Todo (next) |
| 헌혈의집 | (`blood_donation` 참고) | 15050729 대한적십자사 헌혈의집 정보 | file→odcloud | ⬜ Todo |
| 대기질/환경 | (`environment` 참고) | 15073861 에어코리아 대기오염정보 `getMsrstnAcctoRltmMesureDnsty` | Open API | ⬜ Todo |
| Haerapy Status | `haerapy_status` | 내부 시스템 (data.go.kr 아님) | N/A | ⛔ Out of scope |
| Diet / OOTD / Health / Finance / Face Timelapse | (personal) | 개인 데이터, 공개 API 없음 | N/A | ⛔ Personal-only |

Legend: ✅ Done · ⬜ Todo · ⛔ Out of scope

---

## Known issues / TODO

- `fetch_schools.py` (root) has a **syntax bug**: it is missing the
  `def fetch_schools():` line before its body (line ~22), so it does not compile as-is.
  It also has **no env-var key handling** (uses the NEIS sample flow directly).
- The NEIS collectors could later adopt the same **env-var convention**
  (`<PORTAL>_SERVICE_KEY` + per-source endpoint var) used by the data.go.kr
  collectors, for consistency.

---

## How to add a new collector

1. **Copy** `collectors/jeju_golf.py` to `collectors/<new_source>.py` and adapt the
   field mapping / filter to the new dataset.
2. **Add a per-source endpoint env var** (e.g. `DATA_GO_KR_<SOURCE>_ENDPOINT`) and
   document it in `.env.example`.
3. **Reuse** `collectors/datagokr_common.py` (`get_service_key`, `fetch_odcloud`,
   `pick`, `save_json`). For non-odcloud APIs (Open API / LOCALDATA), add a matching
   helper to `datagokr_common.py`.
4. **Write** `collectors/<new_source>_GUIDE.md` (mirror `jeju_golf_GUIDE.md`) and
   `collectors/<new_source>_workflow.json` (mirror `jeju_golf_workflow.json`).
5. **Update** the checklist table above (set status, dataset id, type).
6. Output must land in `data/<new_source>.json`.
