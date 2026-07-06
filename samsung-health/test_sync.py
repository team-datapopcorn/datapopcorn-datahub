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

    def test_bad_file_does_not_block_others(self):
        (self.raw / "a_steps_broken.csv").write_bytes(b"\xff\xfe\x00\x00garbage")
        shutil.copy(FIXTURES / "steps_sample.csv", self.raw / "b_steps_valid.csv")
        counts = sync_health.process_files(self.conn, self.raw)
        self.assertEqual(counts, {"steps": 2})
        self.assertEqual(self.conn.execute("SELECT COUNT(*) FROM steps_daily").fetchone(), (2,))
        self.assertFalse(health_db.is_processed(
            self.conn, "a_steps_broken.csv",
            (self.raw / "a_steps_broken.csv").stat().st_size))

    def test_zero_row_file_not_marked_processed(self):
        f = self.raw / "steps_wrongcols.csv"
        f.write_text("Foo,Bar\n1,2\n")
        counts = sync_health.process_files(self.conn, self.raw)
        self.assertNotIn("steps", counts)
        self.assertFalse(health_db.is_processed(self.conn, "steps_wrongcols.csv", f.stat().st_size))


if __name__ == "__main__":
    unittest.main()
