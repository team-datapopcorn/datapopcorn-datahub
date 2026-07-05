"""Ulleung-gun restaurant collector (data.go.kr dataset 15096283).

Fetches 전국일반음식점표준데이터 (nationwide general-restaurant standard data)
via the data.go.kr standard-data Open API, filters rows whose address is in
울릉군, maps them to the dashboard's ``ulleungdo_restaurants`` schema, and writes
``data/ulleung_restaurants.json``.

Background: the old LOCALDATA (localdata.go.kr) 일반음식점 REST API this data used
to come from was **shut down on 2026-04-16**. Dataset 15096283 is the successor
standard-data feed on data.go.kr. There is no 울릉군-only endpoint, so we fetch
the nationwide feed and **filter client-side on the address field**.

Run:
    python3 collectors/ulleung_restaurants.py

Requires two environment variables (see .env.example):
    DATA_GO_KR_SERVICE_KEY                    — Encoding service key from data.go.kr
    DATA_GO_KR_ULLEUNG_RESTAURANTS_ENDPOINT   — the dataset's standard-data URL
"""

import os
import sys

from datagokr_common import (
    fetch_standard_data,
    get_service_key,
    pick,
    save_json,
)

# Default endpoint carries the placeholder; fetch_standard_data() raises a
# helpful error if it is left unset so we never issue a doomed request.
ENDPOINT_PLACEHOLDER = "PUT-ENDPOINT-HERE"
DEFAULT_ENDPOINT = f"https://apis.data.go.kr/{ENDPOINT_PLACEHOLDER}"

OUTPUT_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data",
    "ulleung_restaurants.json",
)

# Address column candidates, in priority order (road-name first, then 지번).
_ADDRESS_KEYS = (
    "소재지도로명주소",
    "도로명주소",
    "소재지지번주소",
    "지번주소",
    "소재지주소",
    "주소",
)

# Business-status values that clearly mean the shop is gone. We are lenient:
# a row is only dropped when it *has* a status field AND that status is one of
# these closed markers. Rows without the field (or with 영업/정상) are kept.
_CLOSED_STATUSES = ("폐업", "말소", "직권말소", "취소", "폐쇄")


def _address_of(row):
    return pick(row, *_ADDRESS_KEYS, default="")


def _is_open(row):
    """Return True unless the row's 영업상태명 clearly marks it closed.

    Many standard-data rows omit or vary this field, so we default to keeping
    the row and only drop it on an explicit closed status.
    """
    status = pick(row, "영업상태명", "상세영업상태명", default="")
    if not status:
        return True
    return not any(marker in status for marker in _CLOSED_STATUSES)


def map_row(row, index):
    """Map one source row to the target ulleungdo_restaurants schema."""
    source_id = pick(row, "관리번호", "인허가번호")
    return {
        "id": source_id if source_id is not None else index,
        "name": pick(row, "사업장명", "업소명", "상호명"),
        "category": pick(row, "업태구분명", "위생업태명", "업종명"),
        # menu_signature / rating / hours are not in the source dataset.
        "menu_signature": [],
        "price_avg": None,
        "operating_hours": None,
        "closed_days": None,
        "rating": None,
        "address": _address_of(row) or None,
        "contact": pick(row, "소재지전화", "전화번호", "연락처"),
        # Extra useful source fields, kept when present.
        "license_date": pick(row, "인허가일자"),
        "business_status": pick(row, "영업상태명", "상세영업상태명"),
    }


def collect():
    """Fetch, filter to 울릉군, map, and save. Returns the mapped rows."""
    service_key = get_service_key()
    endpoint = os.environ.get(
        "DATA_GO_KR_ULLEUNG_RESTAURANTS_ENDPOINT", DEFAULT_ENDPOINT
    ).strip() or DEFAULT_ENDPOINT

    all_rows = fetch_standard_data(
        endpoint, service_key, placeholder=ENDPOINT_PLACEHOLDER
    )
    print(f"Fetched {len(all_rows)} total restaurant rows from data.go.kr.")

    ulleung_rows = [
        r
        for r in all_rows
        if "울릉군" in _address_of(r) and _is_open(r)
    ]
    print(f"Filtered to {len(ulleung_rows)} open rows located in 울릉군.")

    mapped = [map_row(r, i + 1) for i, r in enumerate(ulleung_rows)]

    save_json(mapped, OUTPUT_PATH)
    print(f"Saved {len(mapped)} Ulleung-gun restaurants to {OUTPUT_PATH}")
    return mapped


def main():
    try:
        collect()
    except RuntimeError as exc:
        # Missing service key or placeholder endpoint — friendly, no traceback.
        print("Cannot run the Ulleung restaurants collector:\n", file=sys.stderr)
        print(str(exc), file=sys.stderr)
        print(
            "\nSetup checklist for dataset 15096283 (전국일반음식점표준데이터):\n"
            "  1. Sign in at https://www.data.go.kr and open\n"
            "     https://www.data.go.kr/data/15096283/standard.do\n"
            "  2. Click 활용신청 and wait for approval for this dataset.\n"
            "  3. On the dataset's API 명세 (spec) page, copy the full request URL.\n"
            "  4. Set the env vars (see .env.example):\n"
            "       export DATA_GO_KR_SERVICE_KEY='<your-encoding-key>'\n"
            "       export DATA_GO_KR_ULLEUNG_RESTAURANTS_ENDPOINT='<the-api-url>'\n"
            "  5. Re-run:  python3 collectors/ulleung_restaurants.py",
            file=sys.stderr,
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
