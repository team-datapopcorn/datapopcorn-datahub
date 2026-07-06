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
