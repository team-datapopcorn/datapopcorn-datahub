"""Parsers for Health Sync CSV exports.

컬럼명은 Health Sync 가정 포맷 기준 — 실제 CSV 확인 후(플랜 Task 6) 어긋나면 여기와
fixtures/ 를 함께 수정한다.
"""
import csv
import logging
from datetime import datetime

log = logging.getLogger(__name__)


def _read_csv(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        yield from csv.DictReader(f)


def _dt(value):
    return datetime.fromisoformat(value.strip())


def _fmt(dt):
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def parse_steps(path):
    rows = []
    for r in _read_csv(path):
        try:
            rows.append({
                "date": r["Date"].strip(),
                "steps": int(float(r["Steps"])),
                "distance_m": float(r.get("Distance") or 0),
                "calories": float(r.get("Calories") or 0),
            })
        except (KeyError, ValueError, TypeError, AttributeError) as e:
            log.warning("steps row skipped in %s: %r (%s)", path, r, e)
    return rows


def parse_sleep(path):
    rows = []
    for r in _read_csv(path):
        try:
            start, end = _dt(r["Start"]), _dt(r["End"])
            rows.append({
                "start_time": _fmt(start),
                "end_time": _fmt(end),
                "duration_min": round((end - start).total_seconds() / 60, 1),
                "stage_summary": (r.get("Sleep stages") or "").strip(),
            })
        except (KeyError, ValueError, TypeError, AttributeError) as e:
            log.warning("sleep row skipped in %s: %r (%s)", path, r, e)
    return rows


def parse_heart_rate(path):
    rows = []
    for r in _read_csv(path):
        try:
            rows.append({
                "measured_at": _fmt(_dt(r["Time"])),
                "bpm": float(r["Heart rate"]),
            })
        except (KeyError, ValueError, TypeError, AttributeError) as e:
            log.warning("heart rate row skipped in %s: %r (%s)", path, r, e)
    return rows


def parse_exercises(path):
    rows = []
    for r in _read_csv(path):
        try:
            start, end = _dt(r["Start"]), _dt(r["End"])
            rows.append({
                "start_time": _fmt(start),
                "type": (r.get("Type") or "").strip(),
                "duration_min": round((end - start).total_seconds() / 60, 1),
                "distance_m": float(r.get("Distance") or 0),
                "calories": float(r.get("Calories") or 0),
            })
        except (KeyError, ValueError, TypeError, AttributeError) as e:
            log.warning("exercise row skipped in %s: %r (%s)", path, r, e)
    return rows
