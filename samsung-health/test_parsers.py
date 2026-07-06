import unittest
from pathlib import Path

import parsers

FIXTURES = Path(__file__).parent / "fixtures"


class ParsersTest(unittest.TestCase):
    def test_parse_steps_minutely(self):
        rows = parsers.parse_steps(FIXTURES / "steps_sample.csv")
        self.assertEqual(len(rows), 3)
        self.assertEqual(rows[1], {
            "measured_at": "2026-07-05 07:51:00", "steps": 14})

    def test_parse_sleep_computes_duration(self):
        rows = parsers.parse_sleep(FIXTURES / "sleep_sample.csv")
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[1]["start_time"], "2026-07-05 23:10:00")
        self.assertEqual(rows[1]["end_time"], "2026-07-06 06:40:00")
        self.assertEqual(rows[1]["duration_min"], 450.0)
        self.assertEqual(rows[1]["stage_summary"], "deep:80;light:300;rem:70")

    def test_parse_heart_rate(self):
        rows = parsers.parse_heart_rate(FIXTURES / "heart_rate_sample.csv")
        self.assertEqual(rows[0], {"measured_at": "2026-07-05 00:00:07", "bpm": 72.0})

    def test_parse_exercises(self):
        rows = parsers.parse_exercises(FIXTURES / "exercise_sample.csv")
        self.assertEqual(rows[0], {
            "start_time": "2026-07-05 07:00:00", "type": "running",
            "duration_min": 31.5, "distance_m": 5000.0, "calories": 350.0})

    def test_bad_row_skipped_not_fatal(self):
        import tempfile, os
        with tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False) as f:
            f.write("날짜,시간,걸음\n2026.07.05 07:51:00,07:51:00,notanumber\n2026.07.06 08:00:00,08:00:00,500\n")
            path = f.name
        try:
            rows = parsers.parse_steps(Path(path))
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["measured_at"], "2026-07-06 08:00:00")
        finally:
            os.unlink(path)

    def test_short_and_blank_rows_skipped_not_fatal(self):
        """Truncated rows (missing fields → None) and blank lines must be skipped, not crash."""
        import tempfile, os
        with tempfile.NamedTemporaryFile("w", suffix=".csv", delete=False) as f:
            # Header, truncated row (missing 시간/걸음), blank line, valid row
            f.write("날짜,시간,걸음\n2026.07.05 07:51:00\n\n2026.07.06 08:00:00,08:00:00,500\n")
            path = f.name
        try:
            rows = parsers.parse_steps(Path(path))
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["measured_at"], "2026-07-06 08:00:00")
        finally:
            os.unlink(path)


if __name__ == "__main__":
    unittest.main()
