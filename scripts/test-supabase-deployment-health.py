import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("health", Path(__file__).with_name("supabase-deployment-health.py"))
health = importlib.util.module_from_spec(spec)
spec.loader.exec_module(health)

class HealthTests(unittest.TestCase):
    def test_healthy(self):
        def get(url, token=None):
            return (200, {"database": "reachable"}) if url == health.HEALTH_URL else (200, {"status": "ACTIVE_HEALTHY"})
        self.assertTrue(all(row[1] == "HEALTHY" for row in health.evaluate("token", get)))

    def test_missing_token_is_not_healthy(self):
        def get(url, token=None):
            self.assertEqual(url, health.HEALTH_URL)
            return 200, {"database": "reachable"}
        rows = health.evaluate("", get)
        self.assertEqual(rows[0][1], "HEALTHY")
        self.assertTrue(all(row[1] == "UNVERIFIED" for row in rows[1:]))

    def test_paused_and_permission_denied(self):
        self.assertEqual(health.project_state("ref", "token", lambda *a: (200, {"status": "INACTIVE"}))[0], "NOT_READY")
        self.assertEqual(health.project_state("ref", "token", lambda *a: (403, {}))[0], "UNVERIFIED")

    def test_live_probe_failure(self):
        rows = health.evaluate("token", lambda url, token=None: (503, {}) if url == health.HEALTH_URL else (200, {"status": "ACTIVE_HEALTHY"}))
        self.assertEqual(rows[0][1], "NOT_READY")

if __name__ == "__main__":
    unittest.main()
