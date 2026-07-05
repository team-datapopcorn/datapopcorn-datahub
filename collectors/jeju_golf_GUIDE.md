# Jeju Golf Course API Guide (data.go.kr 15118920)

## Overview
- **Dataset**: `15118920` 문화체육관광부_전국 골프장 현황 (Nationwide golf course status)
- **data.go.kr page**: https://www.data.go.kr/data/15118920/fileData.do
- **Type**: File data (파일데이터) → exposed as an **odcloud auto open-API**
- **Provider**: 문화체육관광부 (Ministry of Culture, Sports and Tourism)
- **Coverage**: All golf courses nationwide; this collector **filters to 제주 (Jeju)**
- **Target dashboard key**: `jeju_golf_courses` (see `data-hub/src/sampleData.js`)

We use the nationwide dataset and filter to 제주 because it carries per-course
attributes (name, 소재지 address, 홀수 hole count, 구분 type). The Jeju-only
dataset **15010581** contains visitor counts only, so it is **not used** here.

---

## Authentication
- Auth is a single query parameter: **`serviceKey`**.
- Use the **Encoding key** from data.go.kr: 마이페이지 > 인증키 발급현황 (일반 인증키, Encoding).
- **Per-API approval is required**: click **활용신청** on the dataset page and wait for
  approval before the key works for this specific dataset.

---

## Endpoint & Parameters
The odcloud auto open-API endpoint follows this pattern:

```
https://api.odcloud.kr/api/15118920/v1/uddi:<UUID>?page=1&perPage=100&serviceKey=<KEY>&returnType=JSON
```

The exact `uddi:<UUID>` is only visible on the dataset's **오픈 API** tab **after 활용신청**,
so it must be configured via the `DATA_GO_KR_JEJU_GOLF_ENDPOINT` env var.

| Parameter | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| **serviceKey** | STRING | Yes | Encoding service key |
| **page** | INTEGER | Yes | 1-based page index |
| **perPage** | INTEGER | Yes | Rows per page (we use 100) |
| **returnType** | STRING | Yes | `JSON` |

### Response shape (odcloud envelope)
```json
{
  "currentCount": 100,
  "matchCount": 512,
  "page": 1,
  "perPage": 100,
  "totalCount": 512,
  "data": [ { "골프장명": "...", "소재지": "...", "홀수": "18", "구분": "..." } ]
}
```
Pagination: read `totalCount`, loop `page` until all `data` rows are collected
(or `data` comes back empty). The collector sleeps 0.5s between pages.

---

## Field Mapping (source Korean column → target schema)

| Target field | Source column candidates | Notes |
| :--- | :--- | :--- |
| `id` | 일련번호 / 번호 | Falls back to 1-based index |
| `name` | 골프장명 / 사업장명 / 업소명 / 시설명 | First non-empty |
| `address` | 소재지 / 소재지도로명주소 / 소재지지번주소 / 주소 | First non-empty |
| `region` | *(constant)* `"제주"` | |
| `hole_count` | 홀수 / 홀 / 홀수(개) | Parsed to int, else `null` |
| `contact` | 전화번호 / 연락처 / 대표전화 | First non-empty |
| `type` | 구분 | Kept if present |
| `par` | — | Not in source → `null` |
| `green_fee_weekday` | — | Not in source → `null` |
| `green_fee_weekend` | — | Not in source → `null` |
| `rating` | — | Not in source → `null` |

Column names vary between file exports, so the collector uses defensive
`pick()` lookups (`collectors/datagokr_common.py`).

### Jeju filter
After fetching all nationwide rows, we keep only rows whose address column
(소재지) **contains `"제주"`**.

---

## Environment Variables
See `.env.example`.

| Env var | Purpose |
| :--- | :--- |
| `DATA_GO_KR_SERVICE_KEY` | Encoding service key (shared across all data.go.kr collectors) |
| `DATA_GO_KR_JEJU_GOLF_ENDPOINT` | Full odcloud uddi URL for dataset 15118920 |

---

## How to Run
```bash
pip install -r requirements.txt
export DATA_GO_KR_SERVICE_KEY='<your-encoding-key>'
export DATA_GO_KR_JEJU_GOLF_ENDPOINT='https://api.odcloud.kr/api/15118920/v1/uddi:<UUID>'
python3 collectors/jeju_golf.py
```
Output is written to `data/jeju_golf_courses.json` (flat UTF-8 JSON array).
Without a service key or with the placeholder endpoint, the collector prints a
friendly setup checklist and exits with code 1 (no traceback).

---

## Notes
- Alternative Jeju-only dataset **15010581** provides golf-course **visitor
  counts only** (no per-course attributes) and is intentionally **not used**.
- An n8n version of this flow is provided in `collectors/jeju_golf_workflow.json`.
