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

# (파일명 부분 문자열, 파서, upsert) — 실제 Health Sync 파일명 기준 한글 라우팅.
# 예: "걸음 2026.07.05 Samsung Health.csv", "심박수 6월 2026 Samsung Health.csv"
FILE_ROUTES = [
    ("걸음", parsers.parse_steps, health_db.upsert_steps),
    ("수면", parsers.parse_sleep, health_db.upsert_sleep),
    ("심박수", parsers.parse_heart_rate, health_db.upsert_heart_rate),
    ("운동", parsers.parse_exercises, health_db.upsert_exercises),
]

# Health Sync는 데이터 종류마다 Drive 루트에 "Health Sync <종류>" 폴더를 만든다.
FOLDER_PREFIX = "Health Sync "


def list_source_folders(remote_root):
    out = subprocess.run(
        ["rclone", "lsf", remote_root, "--dirs-only"],
        check=True, capture_output=True, text=True).stdout
    return [d.rstrip("/") for d in out.splitlines() if d.startswith(FOLDER_PREFIX)]


def download(remote_root, raw_dir):
    folders = list_source_folders(remote_root)
    if not folders:
        logging.warning("no '%s*' folders found under %s", FOLDER_PREFIX, remote_root)
    for folder in folders:
        subprocess.run(
            ["rclone", "copy", f"{remote_root}{folder}", str(raw_dir),
             "--include", "*.csv"],
            check=True)


def process_files(conn, raw_dir):
    counts = {}
    for f in sorted(Path(raw_dir).glob("*.csv")):
        size = f.stat().st_size
        if health_db.is_processed(conn, f.name, size):
            continue
        for key, parse, upsert in FILE_ROUTES:
            if key in f.name.lower():
                try:
                    rows = parse(f)
                    if not rows:
                        logging.warning("no rows parsed from %s; not marking processed", f.name)
                        break
                    upsert(conn, rows)
                    counts[key] = counts.get(key, 0) + len(rows)
                except Exception:
                    logging.exception("failed to process %s", f.name)
                    break
                else:
                    health_db.mark_processed(conn, f.name, size)
                break
        else:
            logging.warning("unknown csv, skipped: %s", f.name)
    return counts


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--remote", default="gdrive:",
                    help="rclone 원격 루트 — 이 아래의 'Health Sync *' 폴더들을 전부 내려받음")
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
