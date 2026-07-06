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
