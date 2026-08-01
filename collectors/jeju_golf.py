"""Jeju golf course collector (data.go.kr dataset 15118920).

Fetches 문화체육관광부_전국 골프장 현황 via the odcloud file-data open-API,
filters rows located in 제주, maps them to the dashboard's
``jeju_golf_courses`` schema, and writes ``data/jeju_golf_courses.json``.

Run:
    python3 collectors/jeju_golf.py

Requires two environment variables (see .env.example):
    DATA_GO_KR_SERVICE_KEY        — Encoding service key from data.go.kr
    DATA_GO_KR_JEJU_GOLF_ENDPOINT — the dataset's odcloud uddi URL
"""

import os
import sys

from datagokr_common import (
    fetch_odcloud,
    get_service_key,
    pick,
    save_json,
)

# Default endpoint points at the placeholder; fetch_odcloud() raises a helpful
# error if it is left unset so we never issue a doomed request.
DEFAULT_ENDPOINT = (
    "https://api.odcloud.kr/api/15118920/v1/uddi:PUT-UUID-HERE"
)

OUTPUT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data",
    "jeju_golf_courses.json",
)


def _to_int(value):
    """Best-effort parse of a hole count into an int, else None."""
    if value is None:
        return None
    if isinstance(value, int):
        return value
    text = str(value).strip()
    if not text:
        return None
    # Keep leading digits only (handles '18홀', '18 홀', '18개').
    digits = ""
    for ch in text:
        if ch.isdigit():
            digits += ch
        elif digits:
            break
    return int(digits) if digits else None


def map_row(row, index):
    """Map one source row to the target jeju_golf_courses schema."""
    source_id = pick(row, "일련번호", "번호")
    return {
        "id": source_id if source_id is not None else index,
        "name": pick(row, "골프장명", "사업장명", "업소명", "시설명"),
        "address": pick(
            row, "소재지", "소재지도로명주소", "소재지지번주소", "주소"
        ),
        "region": "제주",
        "hole_count": _to_int(pick(row, "홀수", "홀", "홀수(개)")),
        "par": None,
        "green_fee_weekday": None,
        "green_fee_weekend": None,
        "rating": None,
        "contact": pick(row, "전화번호", "연락처", "대표전화"),
        "type": pick(row, "구분"),
    }


def _address_of(row):
    return pick(
        row, "소재지", "소재지도로명주소", "소재지지번주소", "주소", default=""
    )


def collect():
    """Fetch, filter to 제주, map, and save. Returns the mapped rows."""
    service_key = get_service_key()
    endpoint = os.environ.get(
        "DATA_GO_KR_JEJU_GOLF_ENDPOINT", DEFAULT_ENDPOINT
    ).strip() or DEFAULT_ENDPOINT

    all_rows = fetch_odcloud(endpoint, service_key)
    print(f"Fetched {len(all_rows)} total golf-course rows from data.go.kr.")

    jeju_rows = [r for r in all_rows if "제주" in _address_of(r)]
    print(f"Filtered to {len(jeju_rows)} rows located in 제주.")

    mapped = [map_row(r, i + 1) for i, r in enumerate(jeju_rows)]

    save_json(mapped, OUTPUT_PATH)
    print(f"Saved {len(mapped)} Jeju golf courses to {OUTPUT_PATH}")
    return mapped


def main():
    try:
        collect()
    except RuntimeError as exc:
        # Missing service key or placeholder endpoint — friendly, no traceback.
        print("Cannot run the Jeju golf collector:\n", file=sys.stderr)
        print(str(exc), file=sys.stderr)
        print(
            "\nSetup checklist for dataset 15118920 (전국 골프장 현황):\n"
            "  1. Sign in at https://www.data.go.kr and open\n"
            "     https://www.data.go.kr/data/15118920/fileData.do\n"
            "  2. Click 활용신청 and wait for approval for this dataset.\n"
            "  3. On the dataset's 오픈 API tab, copy the full uddi URL.\n"
            "  4. Set the env vars (see .env.example):\n"
            "       export DATA_GO_KR_SERVICE_KEY='<your-encoding-key>'\n"
            "       export DATA_GO_KR_JEJU_GOLF_ENDPOINT='<the-uddi-url>'\n"
            "  5. Re-run:  python3 collectors/jeju_golf.py",
            file=sys.stderr,
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
