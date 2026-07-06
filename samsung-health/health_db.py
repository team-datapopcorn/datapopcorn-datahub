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
