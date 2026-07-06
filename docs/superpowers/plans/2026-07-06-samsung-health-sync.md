# Samsung Health 일일 수집 파이프라인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 갤럭시 밴드의 삼성헬스 데이터(걸음/수면/심박/운동)를 Health Sync 앱 → Google Drive CSV → 홈맥 launchd 일일 잡으로 SQLite에 적재한다.

**Architecture:** 폰의 Health Sync 앱이 Google Drive에 CSV를 자동 업로드한다. 홈맥의 launchd가 매일 06:00에 `sync_health.py`를 실행한다. 스크립트는 rclone으로 새 CSV를 `raw/`에 내려받고, 파일명으로 데이터 종류를 판별해 파싱한 뒤 SQLite에 자연 키 기반 `INSERT OR REPLACE`로 upsert한다(재실행 안전). 처리한 파일은 `sync_state` 테이블(파일명+크기)로 기록해 재파싱을 건너뛴다.

**Tech Stack:** Python 3 표준 라이브러리만 (sqlite3, csv, subprocess, unittest). 외부 pip 의존성 없음. rclone(홈맥에 brew 설치), launchd.

## Global Constraints

- Python 3 stdlib만 사용. pip 패키지 추가 금지.
- `health.db`, `raw/`, `logs/`는 git에 커밋 금지 — `samsung-health/.gitignore`로 차단.
- datahub-mcp-server에 툴 노출 금지 (http.js 무인증 — CLAUDE.md 규칙). 이번 범위 밖.
- 테스트 실행 위치: `cd samsung-health && python3 -m unittest discover -v` (테스트 파일은 `samsung-health/` 최상위의 `test_*.py`).
- CSV 픽스처 포맷은 **가정값**이다. Health Sync가 실제로 만드는 CSV는 Task 6에서 확인하고, 다르면 파서·픽스처를 실제 포맷에 맞게 수정한다.
- 파서 규칙: 행 단위 오류는 warning 로그 후 스킵, 전체 실패로 만들지 않는다.
- 커밋 트레일러: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` + `Claude-Session: https://claude.ai/code/session_01HmPD6nraba715eXS5odZB4`

## File Structure

```
samsung-health/
  .gitignore            # health.db, raw/, logs/
  health_db.py          # 스키마 생성 + upsert + sync_state
  parsers.py            # CSV → dict 리스트 (4종)
  sync_health.py        # 오케스트레이터: rclone 다운로드 → 파일 라우팅 → upsert
  test_health_db.py
  test_parsers.py
  test_sync.py
  fixtures/             # 테스트용 샘플 CSV (커밋됨 — 가짜 데이터)
    steps_sample.csv
    sleep_sample.csv
    heart_rate_sample.csv
    exercise_sample.csv
  ai.datapopcorn.samsung-health.plist
  README.md
```

---

### Task 1: 폴더 스캐폴드 + gitignore

**Files:**
- Create: `samsung-health/.gitignore`

**Interfaces:**
- Produces: `samsung-health/` 폴더, 개인 데이터 커밋 차단 규칙.

- [ ] **Step 1: 폴더와 .gitignore 생성**

`samsung-health/.gitignore`:

```gitignore
health.db
raw/
logs/
```

- [ ] **Step 2: 확인**

Run: `git check-ignore -v samsung-health/health.db samsung-health/raw/x.csv samsung-health/logs/sync.log`
Expected: 세 경로 모두 `samsung-health/.gitignore` 규칙에 매칭되어 출력됨.

- [ ] **Step 3: Commit**

```bash
git add samsung-health/.gitignore
git commit -m "feat(samsung-health): scaffold folder with gitignore for personal data"
```

---

### Task 2: health_db.py — 스키마 + upsert

**Files:**
- Create: `samsung-health/health_db.py`
- Test: `samsung-health/test_health_db.py`

**Interfaces:**
- Produces (Task 4가 사용):
  - `connect(path: str) -> sqlite3.Connection` — 스키마 생성 포함
  - `upsert_steps(conn, rows: list[dict])` — dict 키: `date, steps, distance_m, calories`
  - `upsert_sleep(conn, rows: list[dict])` — 키: `start_time, end_time, duration_min, stage_summary`
  - `upsert_heart_rate(conn, rows: list[dict])` — 키: `measured_at, bpm`
  - `upsert_exercises(conn, rows: list[dict])` — 키: `start_time, type, duration_min, distance_m, calories`
  - `is_processed(conn, filename: str, size: int) -> bool`
  - `mark_processed(conn, filename: str, size: int)`

- [ ] **Step 1: 실패하는 테스트 작성**

`samsung-health/test_health_db.py`:

```python
import unittest

import health_db


class HealthDbTest(unittest.TestCase):
    def setUp(self):
        self.conn = health_db.connect(":memory:")

    def test_upsert_steps_is_idempotent(self):
        rows = [{"date": "2026-07-05", "steps": 8421, "distance_m": 6210.5, "calories": 312.4}]
        health_db.upsert_steps(self.conn, rows)
        health_db.upsert_steps(self.conn, rows)
        got = self.conn.execute("SELECT date, steps FROM steps_daily").fetchall()
        self.assertEqual(got, [("2026-07-05", 8421)])

    def test_upsert_replaces_same_key(self):
        health_db.upsert_steps(self.conn, [{"date": "2026-07-05", "steps": 100, "distance_m": 0, "calories": 0}])
        health_db.upsert_steps(self.conn, [{"date": "2026-07-05", "steps": 200, "distance_m": 0, "calories": 0}])
        got = self.conn.execute("SELECT steps FROM steps_daily WHERE date='2026-07-05'").fetchone()
        self.assertEqual(got, (200,))

    def test_all_tables_exist(self):
        names = {r[0] for r in self.conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'")}
        self.assertTrue({"steps_daily", "sleep_sessions", "heart_rate", "exercises", "sync_state"} <= names)

    def test_sleep_heart_exercise_upserts(self):
        health_db.upsert_sleep(self.conn, [{
            "start_time": "2026-07-05 23:10:00", "end_time": "2026-07-06 06:40:00",
            "duration_min": 450.0, "stage_summary": "deep:80;light:300;rem:70"}])
        health_db.upsert_heart_rate(self.conn, [{"measured_at": "2026-07-05 12:00:00", "bpm": 72.0}])
        health_db.upsert_exercises(self.conn, [{
            "start_time": "2026-07-05 07:00:00", "type": "running",
            "duration_min": 31.5, "distance_m": 5000.0, "calories": 350.0}])
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM sleep_sessions").fetchone(), (1,))
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM heart_rate").fetchone(), (1,))
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM exercises").fetchone(), (1,))

    def test_sync_state_tracking(self):
        self.assertFalse(health_db.is_processed(self.conn, "a.csv", 100))
        health_db.mark_processed(self.conn, "a.csv", 100)
        self.assertTrue(health_db.is_processed(self.conn, "a.csv", 100))
        # 같은 파일이라도 크기가 바뀌면(추가 기록) 재처리 대상
        self.assertFalse(health_db.is_processed(self.conn, "a.csv", 150))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd samsung-health && python3 -m unittest test_health_db -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'health_db'`

- [ ] **Step 3: 구현**

`samsung-health/health_db.py`:

```python
"""SQLite storage for Samsung Health data synced via Health Sync CSVs."""
import sqlite3

SCHEMA = """
CREATE TABLE IF NOT EXISTS steps_daily (
    date        TEXT PRIMARY KEY,   -- YYYY-MM-DD
    steps       INTEGER NOT NULL,
    distance_m  REAL,
    calories    REAL
);
CREATE TABLE IF NOT EXISTS sleep_sessions (
    start_time    TEXT PRIMARY KEY, -- YYYY-MM-DD HH:MM:SS
    end_time      TEXT NOT NULL,
    duration_min  REAL NOT NULL,
    stage_summary TEXT
);
CREATE TABLE IF NOT EXISTS heart_rate (
    measured_at TEXT PRIMARY KEY,   -- YYYY-MM-DD HH:MM:SS
    bpm         REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS exercises (
    start_time   TEXT PRIMARY KEY,  -- YYYY-MM-DD HH:MM:SS
    type         TEXT,
    duration_min REAL,
    distance_m   REAL,
    calories     REAL
);
CREATE TABLE IF NOT EXISTS sync_state (
    filename     TEXT PRIMARY KEY,
    size         INTEGER NOT NULL,
    processed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


def connect(path):
    conn = sqlite3.connect(path)
    conn.executescript(SCHEMA)
    return conn


def upsert_steps(conn, rows):
    conn.executemany(
        "INSERT OR REPLACE INTO steps_daily (date, steps, distance_m, calories) "
        "VALUES (:date, :steps, :distance_m, :calories)", rows)
    conn.commit()


def upsert_sleep(conn, rows):
    conn.executemany(
        "INSERT OR REPLACE INTO sleep_sessions (start_time, end_time, duration_min, stage_summary) "
        "VALUES (:start_time, :end_time, :duration_min, :stage_summary)", rows)
    conn.commit()


def upsert_heart_rate(conn, rows):
    conn.executemany(
        "INSERT OR REPLACE INTO heart_rate (measured_at, bpm) "
        "VALUES (:measured_at, :bpm)", rows)
    conn.commit()


def upsert_exercises(conn, rows):
    conn.executemany(
        "INSERT OR REPLACE INTO exercises (start_time, type, duration_min, distance_m, calories) "
        "VALUES (:start_time, :type, :duration_min, :distance_m, :calories)", rows)
    conn.commit()


def is_processed(conn, filename, size):
    row = conn.execute(
        "SELECT 1 FROM sync_state WHERE filename = ? AND size = ?",
        (filename, size)).fetchone()
    return row is not None


def mark_processed(conn, filename, size):
    conn.execute(
        "INSERT OR REPLACE INTO sync_state (filename, size) VALUES (?, ?)",
        (filename, size))
    conn.commit()
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd samsung-health && python3 -m unittest test_health_db -v`
Expected: PASS (5 tests OK)

- [ ] **Step 5: Commit**

```bash
git add samsung-health/health_db.py samsung-health/test_health_db.py
git commit -m "feat(samsung-health): add SQLite schema and idempotent upserts"
```

---

### Task 3: parsers.py — CSV 파서 4종

**Files:**
- Create: `samsung-health/parsers.py`
- Create: `samsung-health/fixtures/steps_sample.csv`, `sleep_sample.csv`, `heart_rate_sample.csv`, `exercise_sample.csv`
- Test: `samsung-health/test_parsers.py`

**Interfaces:**
- Produces (Task 4가 사용): 각 파서는 `Path`를 받아 Task 2 upsert가 기대하는 키의 dict 리스트 반환.
  - `parse_steps(path) -> list[dict]`
  - `parse_sleep(path) -> list[dict]`
  - `parse_heart_rate(path) -> list[dict]`
  - `parse_exercises(path) -> list[dict]`
- **주의:** 픽스처 컬럼명은 Health Sync 포맷 가정값. Task 6에서 실제 CSV와 대조 후 수정.

- [ ] **Step 1: 픽스처 생성**

`samsung-health/fixtures/steps_sample.csv`:

```csv
Date,Steps,Distance,Calories
2026-07-04,10234,7500.2,401.1
2026-07-05,8421,6210.5,312.4
```

`samsung-health/fixtures/sleep_sample.csv`:

```csv
Start,End,Sleep stages
2026-07-04 23:30:00,2026-07-05 06:50:00,deep:75;light:310;rem:55
2026-07-05 23:10:00,2026-07-06 06:40:00,deep:80;light:300;rem:70
```

`samsung-health/fixtures/heart_rate_sample.csv`:

```csv
Time,Heart rate
2026-07-05 12:00:00,72
2026-07-05 12:10:00,75
```

`samsung-health/fixtures/exercise_sample.csv`:

```csv
Start,End,Type,Distance,Calories
2026-07-05 07:00:00,2026-07-05 07:31:30,running,5000,350
```

- [ ] **Step 2: 실패하는 테스트 작성**

`samsung-health/test_parsers.py`:

```python
import unittest
from pathlib import Path

import parsers

FIXTURES = Path(__file__).parent / "fixtures"


class ParsersTest(unittest.TestCase):
    def test_parse_steps(self):
        rows = parsers.parse_steps(FIXTURES / "steps_sample.csv")
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[1], {
            "date": "2026-07-05", "steps": 8421,
            "distance_m": 6210.5, "calories": 312.4})

    def test_parse_sleep_computes_duration(self):
        rows = parsers.parse_sleep(FIXTURES / "sleep_sample.csv")
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[1]["start_time"], "2026-07-05 23:10:00")
        self.assertEqual(rows[1]["end_time"], "2026-07-06 06:40:00")
        self.assertEqual(rows[1]["duration_min"], 450.0)
        self.assertEqual(rows[1]["stage_summary"], "deep:80;light:300;rem:70")

    def test_parse_heart_rate(self):
        rows = parsers.parse_heart_rate(FIXTURES / "heart_rate_sample.csv")
        self.assertEqual(rows[0], {"measured_at": "2026-07-05 12:00:00", "bpm": 72.0})

    def test_parse_exercises(self):
        rows = parsers.parse_exercises(FIXTURES / "exercise_sample.csv")
        self.assertEqual(rows[0], {
            "start_time": "2026-07-05 07:00:00", "type": "running",
            "duration_min": 31.5, "distance_m": 5000.0, "calories": 350.0})

    def test_bad_row_skipped_not_fatal(self):
        import tempfile, os
        with tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False) as f:
            f.write("Date,Steps,Distance,Calories\n2026-07-05,notanumber,1,1\n2026-07-06,500,1,1\n")
            path = f.name
        try:
            rows = parsers.parse_steps(Path(path))
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["date"], "2026-07-06")
        finally:
            os.unlink(path)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `cd samsung-health && python3 -m unittest test_parsers -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'parsers'`

- [ ] **Step 4: 구현**

`samsung-health/parsers.py`:

```python
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
        except (KeyError, ValueError) as e:
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
        except (KeyError, ValueError) as e:
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
        except (KeyError, ValueError) as e:
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
        except (KeyError, ValueError) as e:
            log.warning("exercise row skipped in %s: %r (%s)", path, r, e)
    return rows
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd samsung-health && python3 -m unittest test_parsers -v`
Expected: PASS (5 tests OK)

- [ ] **Step 6: Commit**

```bash
git add samsung-health/parsers.py samsung-health/test_parsers.py samsung-health/fixtures/
git commit -m "feat(samsung-health): add CSV parsers with sample fixtures"
```

---

### Task 4: sync_health.py — 오케스트레이터

**Files:**
- Create: `samsung-health/sync_health.py`
- Test: `samsung-health/test_sync.py`

**Interfaces:**
- Consumes: Task 2의 `health_db.connect/upsert_*/is_processed/mark_processed`, Task 3의 `parsers.parse_*`.
- Produces: CLI — `python3 sync_health.py [--remote gdrive:HealthSync] [--db PATH] [--raw-dir PATH] [--skip-download]`.
  Task 5 plist가 이 CLI를 호출.
- `process_files(conn, raw_dir: Path) -> dict` — 종류별 upsert 행 수 카운트 반환 (테스트 대상).

- [ ] **Step 1: 실패하는 테스트 작성**

`samsung-health/test_sync.py`:

```python
import shutil
import tempfile
import unittest
from pathlib import Path

import health_db
import sync_health

FIXTURES = Path(__file__).parent / "fixtures"


class ProcessFilesTest(unittest.TestCase):
    def setUp(self):
        self.raw = Path(tempfile.mkdtemp())
        self.conn = health_db.connect(":memory:")

    def tearDown(self):
        shutil.rmtree(self.raw)

    def test_routes_files_by_name_and_upserts(self):
        shutil.copy(FIXTURES / "steps_sample.csv", self.raw / "Health Sync steps 2026-07-05.csv")
        shutil.copy(FIXTURES / "sleep_sample.csv", self.raw / "Health Sync sleep 2026-07-05.csv")
        counts = sync_health.process_files(self.conn, self.raw)
        self.assertEqual(counts, {"steps": 2, "sleep": 2})
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM steps_daily").fetchone(), (2,))

    def test_second_run_skips_processed_files(self):
        shutil.copy(FIXTURES / "steps_sample.csv", self.raw / "steps.csv")
        sync_health.process_files(self.conn, self.raw)
        counts = sync_health.process_files(self.conn, self.raw)
        self.assertEqual(counts, {})

    def test_unknown_file_skipped(self):
        (self.raw / "mystery.csv").write_text("a,b\n1,2\n")
        counts = sync_health.process_files(self.conn, self.raw)
        self.assertEqual(counts, {})


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd samsung-health && python3 -m unittest test_sync -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'sync_health'`

- [ ] **Step 3: 구현**

`samsung-health/sync_health.py`:

```python
#!/usr/bin/env python3
"""Daily Samsung Health sync: rclone-download Health Sync CSVs, parse, upsert into SQLite.

launchd(ai.datapopcorn.samsung-health)가 매일 실행. 수동 실행:
  python3 sync_health.py --skip-download   # 이미 받아둔 raw/ 만 처리
"""
import argparse
import logging
import subprocess
import sys
from pathlib import Path

import health_db
import parsers

BASE = Path(__file__).resolve().parent

# (파일명 부분 문자열, 파서, upsert) — 파일명 라우팅. 실제 Health Sync 파일명 확인 후 조정.
FILE_ROUTES = [
    ("steps", parsers.parse_steps, health_db.upsert_steps),
    ("sleep", parsers.parse_sleep, health_db.upsert_sleep),
    ("heart", parsers.parse_heart_rate, health_db.upsert_heart_rate),
    ("exercise", parsers.parse_exercises, health_db.upsert_exercises),
]


def download(remote, raw_dir):
    subprocess.run(
        ["rclone", "copy", remote, str(raw_dir), "--include", "*.csv"],
        check=True)


def process_files(conn, raw_dir):
    counts = {}
    for f in sorted(Path(raw_dir).glob("*.csv")):
        size = f.stat().st_size
        if health_db.is_processed(conn, f.name, size):
            continue
        for key, parse, upsert in FILE_ROUTES:
            if key in f.name.lower():
                rows = parse(f)
                upsert(conn, rows)
                counts[key] = counts.get(key, 0) + len(rows)
                break
        else:
            logging.warning("unknown csv, skipped: %s", f.name)
            continue
        health_db.mark_processed(conn, f.name, size)
    return counts


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--remote", default="gdrive:HealthSync")
    ap.add_argument("--db", default=str(BASE / "health.db"))
    ap.add_argument("--raw-dir", default=str(BASE / "raw"))
    ap.add_argument("--skip-download", action="store_true")
    args = ap.parse_args()

    log_dir = BASE / "logs"
    log_dir.mkdir(exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[
            logging.FileHandler(log_dir / "sync.log"),
            logging.StreamHandler(),
        ])

    raw_dir = Path(args.raw_dir)
    raw_dir.mkdir(exist_ok=True)
    if not args.skip_download:
        download(args.remote, raw_dir)
    conn = health_db.connect(args.db)
    counts = process_files(conn, raw_dir)
    logging.info("sync done: %s", counts or "no new files")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        logging.exception("sync failed")
        sys.exit(1)
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd samsung-health && python3 -m unittest discover -v`
Expected: PASS — Task 2·3·4 테스트 전부 (13 tests OK)

- [ ] **Step 5: Commit**

```bash
git add samsung-health/sync_health.py samsung-health/test_sync.py
git commit -m "feat(samsung-health): add daily sync orchestrator with file routing"
```

---

### Task 5: launchd plist + README

**Files:**
- Create: `samsung-health/ai.datapopcorn.samsung-health.plist`
- Create: `samsung-health/README.md`

**Interfaces:**
- Consumes: Task 4 CLI (`sync_health.py`).
- Produces: 홈맥 배포 절차 문서 + 매일 06:00 실행 에이전트.

- [ ] **Step 1: plist 작성**

`samsung-health/ai.datapopcorn.samsung-health.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>ai.datapopcorn.samsung-health</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>/Users/popcorn/Documents/GitHub/datapopcorn-datahub/samsung-health/sync_health.py</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>6</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
    <key>StandardOutPath</key>
    <string>/Users/popcorn/Documents/GitHub/datapopcorn-datahub/samsung-health/logs/launchd.out.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/popcorn/Documents/GitHub/datapopcorn-datahub/samsung-health/logs/launchd.err.log</string>
</dict>
</plist>
```

주의: 경로는 홈맥(`datapopcorn-popcorn-mbp`)의 실제 레포 경로에 맞춰 수정 — README에 명시.

- [ ] **Step 2: plist 문법 검증**

Run: `plutil -lint samsung-health/ai.datapopcorn.samsung-health.plist`
Expected: `samsung-health/ai.datapopcorn.samsung-health.plist: OK`

- [ ] **Step 3: README 작성**

`samsung-health/README.md`:

````markdown
# samsung-health

갤럭시 밴드 → 삼성헬스 데이터(걸음/수면/심박/운동)를 매일 1회 SQLite로 수집하는 파이프라인.

## 데이터 흐름

```
갤럭시 밴드 → 삼성헬스 앱 → Health Connect
  → Health Sync 앱 (폰, 자동) → Google Drive CSV
  → 홈맥 launchd (매일 06:00) → sync_health.py → health.db (SQLite)
```

## 파일

| 파일 | 역할 |
|------|------|
| `sync_health.py` | rclone으로 CSV 다운로드 → 파싱 → upsert. 진입점 |
| `health_db.py` | SQLite 스키마 + idempotent upsert |
| `parsers.py` | Health Sync CSV 파서 4종 |
| `health.db` | 데이터 저장소 (gitignore — 커밋 금지) |
| `raw/` | CSV 원본 보관 (gitignore) |
| `logs/` | 실행 로그 (gitignore) |
| `ai.datapopcorn.samsung-health.plist` | launchd 에이전트 (매일 06:00) |

## 설치 (1회)

### 1. 폰: Health Sync 설정

1. Play 스토어에서 Health Sync(appyhapps) 설치.
2. 동기화 방향: Samsung Health(또는 Health Connect) → **Google Drive**, 포맷 CSV.
3. 동기화 항목: 걸음수, 수면, 심박수, 운동.
4. Drive 폴더 이름 확인 (기본값을 `--remote`에 반영).

### 2. 홈맥: rclone 인증

```bash
brew install rclone
rclone config   # n → 이름 gdrive → drive 선택 → 브라우저 OAuth 인증
rclone ls gdrive:HealthSync   # CSV 보이는지 확인 (폴더명은 Health Sync 설정값)
```

### 3. 첫 수동 실행 + 파서 검증

```bash
python3 sync_health.py --remote gdrive:HealthSync
sqlite3 health.db "SELECT * FROM steps_daily ORDER BY date DESC LIMIT 5;"
```

실제 CSV 컬럼이 파서 가정과 다르면 `parsers.py`의 컬럼명과 `fixtures/`를 실제 포맷에 맞춰 수정.

### 4. launchd 등록

```bash
# plist 안 경로가 이 레포의 실제 경로인지 먼저 확인/수정
cp ai.datapopcorn.samsung-health.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/ai.datapopcorn.samsung-health.plist
launchctl start ai.datapopcorn.samsung-health   # 즉시 1회 실행해 확인
tail -20 logs/sync.log
```

## 운영

- 재실행 안전: 자연 키 `INSERT OR REPLACE` + `sync_state`(파일명+크기)로 중복 없음.
- 실패 시: `logs/sync.log`, `logs/launchd.err.log` 확인. 다음 실행에서 밀린 파일까지 자동 처리.
- 테스트: `python3 -m unittest discover -v`

## 주의

- `health.db`/`raw/`는 개인 건강 데이터 — git 커밋 금지 (`.gitignore` 처리됨).
- datahub-mcp-server 툴 노출은 http.js 인증 추가 전까지 금지 (CLAUDE.md).
````

- [ ] **Step 4: Commit**

```bash
git add samsung-health/ai.datapopcorn.samsung-health.plist samsung-health/README.md
git commit -m "feat(samsung-health): add launchd agent and setup README"
```

---

### Task 6: 실제 연동 검증 (수동 — 사용자 폰 설정 필요)

**Files:**
- Modify (필요 시): `samsung-health/parsers.py`, `samsung-health/fixtures/*.csv`, `samsung-health/sync_health.py`(FILE_ROUTES)

**Interfaces:**
- Consumes: Task 1–5 전체. 사용자가 폰에 Health Sync 설정 완료해야 진행 가능.

- [ ] **Step 1: 폰에서 Health Sync 설정 완료 (사용자)** — README §1 절차. 최초 동기화로 Drive에 CSV 생성 확인.
- [ ] **Step 2: 홈맥 rclone 인증 (사용자)** — README §2. `rclone ls`로 CSV 목록 확인.
- [ ] **Step 3: 실제 CSV 1벌 확보** — `rclone copy`로 받아 컬럼명·파일명 패턴 확인.
- [ ] **Step 4: 파서/라우팅 대조** — 실제 컬럼명이 가정과 다르면: fixtures를 실제 포맷(가짜 값)으로 교체 → 테스트 수정 → 파서 수정 → `python3 -m unittest discover -v` PASS. `FILE_ROUTES`의 부분 문자열도 실제 파일명에 맞게 조정.
- [ ] **Step 5: 엔드투엔드 실행** — `python3 sync_health.py` → `sqlite3 health.db`로 4개 테이블 행 확인. 같은 명령 재실행 → 행 수 불변 확인.
- [ ] **Step 6: launchd 등록** — README §4. `launchctl start`로 즉시 실행 확인.
- [ ] **Step 7: 변경분 커밋**

```bash
git add samsung-health/
git commit -m "fix(samsung-health): align parsers with real Health Sync CSV format"
```
