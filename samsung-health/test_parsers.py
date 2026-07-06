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

    def test_short_and_blank_rows_skipped_not_fatal(self):
        """Truncated rows (missing fields → None) and blank lines must be skipped, not crash."""
        import tempfile, os
        with tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False) as f:
            # Header, truncated row (missing Steps/Distance/Calories), blank line, valid row
            f.write("Date,Steps,Distance,Calories\n2026-07-05\n\n2026-07-06,500,1,1\n")
            path = f.name
        try:
            rows = parsers.parse_steps(Path(path))
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["date"], "2026-07-06")
        finally:
            os.unlink(path)


if __name__ == "__main__":
    unittest.main()
