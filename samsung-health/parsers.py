"""Parsers for Health Sync CSV exports.

걸음/심박수 컬럼은 실제 Health Sync CSV(한글 헤더, `2026.07.05 07:51:00` 타임스탬프) 기준.
수면/운동은 폰 Health Sync에서 아직 동기화 미설정 — 활성화 후 실제 CSV 보고 컬럼 확정 필요
(그 전까지는 0행 파싱 → 파일이 processed로 마킹되지 않고 경고만 남음).
"""
import csv
import logging
from datetime import datetime

log = logging.getLogger(__name__)


def _read_csv(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        yield from csv.DictReader(f)


def _dt(value):
    v = value.strip()
    try:
        return datetime.strptime(v, "%Y.%m.%d %H:%M:%S")  # Health Sync 실제 포맷
    except ValueError:
        return datetime.fromisoformat(v)


def _fmt(dt):
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def parse_steps(path):
    """분 단위 걸음 기록: 날짜(전체 datetime), 시간(중복), 걸음."""
    rows = []
    for r in _read_csv(path):
        try:
            rows.append({
                "measured_at": _fmt(_dt(r["날짜"])),
                "steps": int(float(r["걸음"])),
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
    """심박 기록: 날짜(전체 datetime), 시간(중복), 심박수, 데이터 소스(무시)."""
    rows = []
    for r in _read_csv(path):
        try:
            rows.append({
                "measured_at": _fmt(_dt(r["날짜"])),
                "bpm": float(r["심박수"]),
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
