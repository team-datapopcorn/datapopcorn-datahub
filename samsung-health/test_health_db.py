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
