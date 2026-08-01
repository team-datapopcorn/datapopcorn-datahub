"""Reusable data.go.kr (공공데이터포털) client helpers.

This module provides a thin, dependency-light client for data.go.kr APIs,
shared by every collector under ``collectors/``. It focuses on the "file data"
auto open-APIs hosted on ``api.odcloud.kr`` (odcloud), which return a JSON
envelope of the shape::

    {
        "currentCount": 100,
        "matchCount": 512,
        "page": 1,
        "perPage": 100,
        "totalCount": 512,
        "data": [ { <row> }, ... ]
    }

Auth is a single query parameter ``serviceKey`` (use the *Encoding* key from
마이페이지 > 인증키 발급현황). Note that every API must be approved separately via
활용신청 on its dataset page before the key will work for that endpoint.

Only the Python standard library and ``requests`` are used.
"""

import json
import os
import time

import requests

# Placeholder embedded in .env.example; a real UUID must replace it.
_PLACEHOLDER_UUID = "PUT-UUID-HERE"

_SERVICE_KEY_HELP = (
    "DATA_GO_KR_SERVICE_KEY is not set.\n"
    "  1. Sign in at https://www.data.go.kr and open 마이페이지 > 인증키 발급현황.\n"
    "  2. Copy the ENCODING key (일반 인증키, Encoding).\n"
    "  3. Export it, e.g.  export DATA_GO_KR_SERVICE_KEY='<your-encoding-key>'\n"
    "     (or add it to a .env file — see .env.example).\n"
    "  Remember: each dataset/API also needs its own 활용신청 approval."
)


def get_service_key():
    """Return the data.go.kr service key from the environment.

    Raises:
        RuntimeError: if ``DATA_GO_KR_SERVICE_KEY`` is unset or empty, with a
            message explaining how to obtain and set it.
    """
    key = os.environ.get("DATA_GO_KR_SERVICE_KEY", "").strip()
    if not key:
        raise RuntimeError(_SERVICE_KEY_HELP)
    return key


def fetch_odcloud(
    endpoint,
    service_key,
    per_page=100,
    extra_params=None,
    sleep_sec=0.5,
    max_pages=1000,
):
    """Fetch every row from an odcloud file-API endpoint, paginating fully.

    Args:
        endpoint: Full odcloud URL including the ``uddi:<UUID>`` path, e.g.
            ``https://api.odcloud.kr/api/15118920/v1/uddi:<UUID>``.
        service_key: The Encoding service key (see :func:`get_service_key`).
        per_page: Rows per page (odcloud ``perPage``).
        extra_params: Optional dict of additional query params to merge in.
        sleep_sec: Seconds to sleep between page requests (be polite).
        max_pages: Safety cap on the number of pages to request.

    Returns:
        list[dict]: All row dicts collected across pages.

    Raises:
        RuntimeError: if the endpoint still contains the placeholder UUID.
        requests.HTTPError: on any non-2xx response (response text included).
    """
    if _PLACEHOLDER_UUID in endpoint:
        raise RuntimeError(
            "The odcloud endpoint still contains the placeholder "
            f"'{_PLACEHOLDER_UUID}'.\n"
            "  Open the dataset's 오픈 API tab on data.go.kr (after 활용신청) and\n"
            "  copy the full uddi URL, then set it via the "
            "DATA_GO_KR_JEJU_GOLF_ENDPOINT env var, e.g.\n"
            "    export DATA_GO_KR_JEJU_GOLF_ENDPOINT="
            "'https://api.odcloud.kr/api/15118920/v1/uddi:xxxxxxxx-...'"
        )

    rows = []
    page = 1
    total_count = None

    while page <= max_pages:
        params = {
            "page": page,
            "perPage": per_page,
            "serviceKey": service_key,
            "returnType": "JSON",
        }
        if extra_params:
            params.update(extra_params)

        response = requests.get(endpoint, params=params, timeout=30)
        if not response.ok:
            raise requests.HTTPError(
                f"data.go.kr request failed: HTTP {response.status_code} "
                f"for page {page}\nResponse body: {response.text}"
            )

        payload = response.json()
        if total_count is None:
            total_count = payload.get("totalCount")

        data = payload.get("data") or []
        if not data:
            break

        rows.extend(data)

        # Stop once we've collected everything the API reports.
        if total_count is not None and len(rows) >= total_count:
            break

        page += 1
        if sleep_sec:
            time.sleep(sleep_sec)

    return rows


def _extract_standard_rows(payload):
    """Extract the row list and reported total from a standard-data payload.

    Standard-data (표준데이터) APIs are inconsistent about where the rows live,
    so this helper probes the common shapes defensively:

    * ``response.body.items`` as a list, or
    * ``response.body.items.item`` as a list or a single dict, or
    * a top-level ``data`` list (odcloud-style fallback).

    Returns:
        tuple(list[dict], int | None): the rows and the reported ``totalCount``
        (``None`` when the payload does not expose one).
    """
    if not isinstance(payload, dict):
        return [], None

    # Top-level odcloud-style fallback.
    if isinstance(payload.get("data"), list):
        return payload["data"], payload.get("totalCount")

    response = payload.get("response", payload)
    if not isinstance(response, dict):
        return [], None

    body = response.get("body", response)
    if not isinstance(body, dict):
        return [], None

    total_count = body.get("totalCount")
    if isinstance(total_count, str) and total_count.strip().isdigit():
        total_count = int(total_count)

    items = body.get("items")
    rows = []
    if isinstance(items, list):
        rows = items
    elif isinstance(items, dict):
        item = items.get("item", items)
        if isinstance(item, list):
            rows = item
        elif isinstance(item, dict):
            rows = [item]
    elif isinstance(body.get("data"), list):
        rows = body["data"]

    # Keep only dict rows (defend against stray scalars/strings).
    rows = [r for r in rows if isinstance(r, dict)]
    return rows, total_count


def fetch_standard_data(
    endpoint,
    service_key,
    num_of_rows=100,
    extra_params=None,
    sleep_sec=0.5,
    max_pages=1000,
    placeholder="PUT-UUID-HERE",
):
    """Fetch every row from a classic data.go.kr standard-data Open API.

    Standard-data (표준데이터셋) REST APIs paginate with ``pageNo`` (1-based) and
    ``numOfRows`` and typically return a nested envelope::

        {"response": {"header": {...},
                      "body": {"items": [...] or {"item": [...]},
                               "totalCount": N, "numOfRows": n, "pageNo": p}}}

    Because the exact endpoint, parameter casing, and response nesting vary
    between datasets, parsing is done defensively via
    :func:`_extract_standard_rows`.

    Args:
        endpoint: Full API URL (excluding query params). Configured per-source
            via an env var; the default ships with ``placeholder`` embedded so a
            misconfigured run fails loudly instead of hitting a dead URL.
        service_key: The Encoding service key (see :func:`get_service_key`).
        num_of_rows: Rows per page (``numOfRows``).
        extra_params: Optional dict of additional query params to merge in.
        sleep_sec: Seconds to sleep between page requests (be polite).
        max_pages: Safety cap on the number of pages to request.
        placeholder: Sentinel string that, if still present in ``endpoint``,
            means the URL was never configured.

    Returns:
        list[dict]: All row dicts collected across pages.

    Raises:
        RuntimeError: if the endpoint still contains ``placeholder``.
        requests.HTTPError: on any non-2xx response (response text included).
    """
    if placeholder and placeholder in endpoint:
        raise RuntimeError(
            "The standard-data endpoint still contains the placeholder "
            f"'{placeholder}'.\n"
            "  Open the dataset's API 명세 (spec) page on data.go.kr (after\n"
            "  활용신청) and copy the full request URL, then set it via the\n"
            "  dataset's endpoint env var, e.g.\n"
            "    export DATA_GO_KR_ULLEUNG_RESTAURANTS_ENDPOINT="
            "'https://apis.data.go.kr/<...>/getGnrlFoodStandardData'"
        )

    rows = []
    page = 1
    total_count = None

    while page <= max_pages:
        params = {
            "serviceKey": service_key,
            "pageNo": page,
            "numOfRows": num_of_rows,
            "type": "json",
        }
        if extra_params:
            params.update(extra_params)

        response = requests.get(endpoint, params=params, timeout=30)
        if not response.ok:
            raise requests.HTTPError(
                f"data.go.kr request failed: HTTP {response.status_code} "
                f"for pageNo {page}\nResponse body: {response.text}"
            )

        try:
            payload = response.json()
        except ValueError as exc:
            raise requests.HTTPError(
                f"data.go.kr returned non-JSON for pageNo {page} "
                f"(check type=json support / serviceKey / 활용신청).\n"
                f"Response body: {response.text}"
            ) from exc

        page_rows, page_total = _extract_standard_rows(payload)
        if total_count is None and page_total is not None:
            total_count = page_total

        # No rows on this page → we've reached the end (works even when the API
        # never reports a usable totalCount).
        if not page_rows:
            break

        rows.extend(page_rows)

        # Stop once we've collected everything the API reports.
        if total_count is not None and len(rows) >= total_count:
            break

        page += 1
        if sleep_sec:
            time.sleep(sleep_sec)

    return rows


def pick(row, *candidate_keys, default=None):
    """Return the first present, non-empty value among ``candidate_keys``.

    Korean CSV/file datasets vary their column headers between exports, so
    collectors pass several candidate names and take whichever exists.

    Args:
        row: A row dict.
        *candidate_keys: Column names to try, in priority order.
        default: Value to return when none match.

    Returns:
        The first non-empty matching value, else ``default``.
    """
    for key in candidate_keys:
        if key in row:
            value = row[key]
            if value is None:
                continue
            if isinstance(value, str):
                stripped = value.strip()
                if stripped:
                    return stripped
                continue
            return value
    return default


def save_json(rows, path):
    """Write ``rows`` to ``path`` as pretty UTF-8 JSON, creating parent dirs."""
    parent = os.path.dirname(os.path.abspath(path))
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
