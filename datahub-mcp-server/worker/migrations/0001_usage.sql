CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  created_at TEXT NOT NULL,
  last_login_at TEXT,
  logins INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  day TEXT NOT NULL,
  user_id TEXT,
  client_id TEXT,
  kind TEXT NOT NULL,          -- login | rpc
  method TEXT,
  tool TEXT,
  ok INTEGER DEFAULT 1,
  ms INTEGER
);
CREATE INDEX IF NOT EXISTS idx_events_day ON events(day);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id, ts);
CREATE TABLE IF NOT EXISTS clients (
  client_id TEXT PRIMARY KEY,
  name TEXT,
  first_seen TEXT
);
