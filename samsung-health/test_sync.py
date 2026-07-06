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
        shutil.copy(FIXTURES / "steps_sample.csv", self.raw / "걸음 2026.07.05 Samsung Health.csv")
        shutil.copy(FIXTURES / "heart_rate_sample.csv", self.raw / "심박수 2026.07.05 Samsung Health.csv")
        counts = sync_health.process_files(self.conn, self.raw)
        self.assertEqual(counts, {"걸음": 3, "심박수": 2})
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM steps_minutely").fetchone(), (3,))
        # 일별 뷰: 2026-07-04 = 120, 2026-07-05 = 14+13
        got = self.conn.execute("SELECT date, steps FROM steps_daily ORDER BY date").fetchall()
        self.assertEqual(got, [("2026-07-04", 120), ("2026-07-05", 27)])

    def test_overlapping_daily_weekly_files_dedupe(self):
        # Health Sync는 같은 데이터를 일별/주별/월별 파일에 중복 기록 — upsert가 자연 키로 dedupe
        shutil.copy(FIXTURES / "steps_sample.csv", self.raw / "걸음 2026.07.05 Samsung Health.csv")
        shutil.copy(FIXTURES / "steps_sample.csv", self.raw / "걸음 27-2026 Samsung Health.csv")
        sync_health.process_files(self.conn, self.raw)
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM steps_minutely").fetchone(), (3,))

    def test_second_run_skips_processed_files(self):
        shutil.copy(FIXTURES / "steps_sample.csv", self.raw / "걸음 2026.07.05 Samsung Health.csv")
        sync_health.process_files(self.conn, self.raw)
        counts = sync_health.process_files(self.conn, self.raw)
        self.assertEqual(counts, {})

    def test_unknown_file_skipped(self):
        (self.raw / "mystery.csv").write_text("a,b\n1,2\n")
        counts = sync_health.process_files(self.conn, self.raw)
        self.assertEqual(counts, {})

    def test_bad_file_does_not_block_others(self):
        (self.raw / "가_걸음_broken.csv").write_bytes(b"\xff\xfe\x00\x00garbage")
        shutil.copy(FIXTURES / "steps_sample.csv", self.raw / "나_걸음_valid.csv")
        counts = sync_health.process_files(self.conn, self.raw)
        self.assertEqual(counts, {"걸음": 3})
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM steps_minutely").fetchone(), (3,))
        self.assertFalse(health_db.is_processed(
            self.conn, "가_걸음_broken.csv",
            (self.raw / "가_걸음_broken.csv").stat().st_size))

    def test_zero_row_file_not_marked_processed(self):
        f = self.raw / "걸음_wrongcols.csv"
        f.write_text("Foo,Bar\n1,2\n")
        counts = sync_health.process_files(self.conn, self.raw)
        self.assertNotIn("걸음", counts)
        self.assertFalse(health_db.is_processed(self.conn, "걸음_wrongcols.csv", f.stat().st_size))


if __name__ == "__main__":
    unittest.main()
