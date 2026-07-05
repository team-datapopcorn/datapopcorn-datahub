# Ulleung-gun Restaurants API Guide (data.go.kr 15096283)

## Overview
- **Dataset**: `15096283` 전국일반음식점표준데이터 (Nationwide general-restaurant standard data)
- **data.go.kr page**: https://www.data.go.kr/data/15096283/standard.do
- **Type**: Standard data (표준데이터셋) → exposed as a **REST Open API** (JSON/XML)
- **Coverage**: All general restaurants nationwide; this collector **filters to 울릉군 (Ulleung-gun)**
- **Target dashboard key**: `ulleungdo_restaurants` (see `data-hub/src/sampleData.js`)

### Why this dataset (LOCALDATA closure)
This data used to be pulled from **LOCALDATA** (`localdata.go.kr`, 일반음식점
`opnSvcId=07_24_04_P`, filtered by 울릉군 localCode). **LOCALDATA's legacy REST API
was shut down on 2026-04-16**, so it is dead and must not be used. Dataset
**15096283 「전국일반음식점표준데이터」** on data.go.kr is the successor standard-data
feed and is what this collector builds on.

There is no 울릉군-only endpoint, so we fetch the nationwide feed and filter
**client-side on the address field** (do NOT rely on the old LOCALDATA localCode).

---

## Authentication
- Auth is a single query parameter: **`serviceKey`**.
- Use the **Encoding key** from data.go.kr: 마이페이지 > 인증키 발급현황 (일반 인증키, Encoding).
- **Per-API approval is required**: click **활용신청** on the dataset page and wait for
  approval before the key works for this specific API.

---

## Endpoint & Parameters
The standard-data Open API endpoint (host `apis.data.go.kr`) is only shown on the
dataset's **API 명세 (spec)** page **after 활용신청**, so the full URL must be
configured via the `DATA_GO_KR_ULLEUNG_RESTAURANTS_ENDPOINT` env var. The default
ships with a `PUT-...-HERE` placeholder that makes the collector fail loudly if it
is left unset.

```
https://apis.data.go.kr/<...>/<operation>?serviceKey=<KEY>&pageNo=1&numOfRows=100&type=json
```

| Parameter | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| **serviceKey** | STRING | Yes | Encoding service key |
| **pageNo** | INTEGER | Yes | 1-based page index |
| **numOfRows** | INTEGER | Yes | Rows per page (we use 100) |
| **type** | STRING | Yes | `json` (this collector parses JSON) |

> The exact endpoint/parameter casing is **unverified** (data.go.kr 403s automated
> fetches). The collector therefore keeps the endpoint env-configurable and parses
> the response **defensively**.

### Response shape (standard-data envelope)
Classic standard-data APIs return a nested envelope:
```json
{
  "response": {
    "header": { "resultCode": "00", "resultMsg": "NORMAL SERVICE." },
    "body": {
      "items": [ { "사업장명": "...", "소재지도로명주소": "...", "업태구분명": "..." } ],
      "totalCount": 512,
      "numOfRows": 100,
      "pageNo": 1
    }
  }
}
```
The rows may appear as `response.body.items` (list), `response.body.items.item`
(list or single dict), or a top-level `data` list. The shared helper
`_extract_standard_rows()` in `collectors/datagokr_common.py` probes all of these
and pulls out `totalCount` regardless of shape. Pagination reads `totalCount` and
loops `pageNo`; if `totalCount` is unavailable it stops when a page returns zero
rows. The collector sleeps 0.5s between pages.

---

## Field Mapping (source Korean column → target schema)

| Target field | Source column candidates | Notes |
| :--- | :--- | :--- |
| `id` | 관리번호 / 인허가번호 | Falls back to 1-based index |
| `name` | 사업장명 / 업소명 / 상호명 | First non-empty |
| `category` | 업태구분명 / 위생업태명 / 업종명 | First non-empty |
| `address` | 소재지도로명주소 / 도로명주소 / 소재지지번주소 / 지번주소 / 소재지주소 / 주소 | Road-name first |
| `contact` | 소재지전화 / 전화번호 / 연락처 | First non-empty |
| `license_date` | 인허가일자 | Extra field, kept if present |
| `business_status` | 영업상태명 / 상세영업상태명 | Extra field, kept if present |
| `menu_signature` | — | Not in source → `[]` |
| `price_avg` | — | Not in source → `null` |
| `operating_hours` | — | Not in source → `null` |
| `closed_days` | — | Not in source → `null` |
| `rating` | — | Not in source → `null` |

Column names vary between exports, so the collector uses defensive `pick()`
lookups (`collectors/datagokr_common.py`).

### 울릉군 filter
After fetching all nationwide rows, we keep only rows whose address column
**contains `"울릉군"`**. We additionally drop rows whose `영업상태명` clearly marks
them closed (폐업 / 말소 / 직권말소 / 취소 / 폐쇄). The status check is **lenient**:
rows without the field (or marked 영업/정상) are kept, since many standard-data rows
omit it.

---

## Environment Variables
See `.env.example`.

| Env var | Purpose |
| :--- | :--- |
| `DATA_GO_KR_SERVICE_KEY` | Encoding service key (shared across all data.go.kr collectors) |
| `DATA_GO_KR_ULLEUNG_RESTAURANTS_ENDPOINT` | Full standard-data API URL for dataset 15096283 |

---

## How to Run
```bash
pip install -r requirements.txt
export DATA_GO_KR_SERVICE_KEY='<your-encoding-key>'
export DATA_GO_KR_ULLEUNG_RESTAURANTS_ENDPOINT='https://apis.data.go.kr/<...>/<operation>'
python3 collectors/ulleung_restaurants.py
```
Output is written to `data/ulleung_restaurants.json` (flat UTF-8 JSON array).
Without a service key or with the placeholder endpoint, the collector prints a
friendly setup checklist and exits with code 1 (no traceback).

---

## Notes
- **Fallback dataset**: 경상북도_음식점 현황 **15101688** (file → odcloud) can be used
  if 15096283 does not resolve for 울릉군; it is a Gyeongsangbuk-do file dataset and
  would be filtered to 울릉군 the same way. Not built on here.
- An n8n version of this flow is provided in
  `collectors/ulleung_restaurants_workflow.json`.
