import json
import unittest
from urllib.error import HTTPError, URLError

from status_prober.main import load_config, probe_target, submit_probe


class FakeResponse:
    def __init__(self, status=200, body=b""):
        self.status = status
        self.body = body

    def getcode(self):
        return self.status

    def read(self, _size=None):
        return self.body

    def __enter__(self):
        return self

    def __exit__(self, _exception_type, _exception, _traceback):
        return False


class ProberTests(unittest.TestCase):
    def test_successful_http_probe(self):
        times = iter([10.0, 10.125])

        result = probe_target(
            {
                "serviceId": "example-site",
                "url": "https://example.com",
            },
            "eu-north-1",
            5,
            open_url=lambda request, timeout: FakeResponse(200),
            clock=lambda: next(times),
            timestamp_factory=lambda: "2026-10-06T00:00:00.000Z",
        )

        self.assertEqual(
            result,
            {
                "serviceId": "example-site",
                "region": "eu-north-1",
                "checkedAt": "2026-10-06T00:00:00.000Z",
                "httpStatus": 200,
                "responseTimeMs": 125,
                "success": True,
            },
        )

    def test_http_error_is_a_failed_probe(self):
        times = iter([20.0, 20.25])

        def fail_request(_request, timeout):
            raise HTTPError(
                "https://example.com",
                503,
                "Service Unavailable",
                {},
                None,
            )

        result = probe_target(
            {
                "serviceId": "example-site",
                "url": "https://example.com",
            },
            "eu-north-1",
            5,
            open_url=fail_request,
            clock=lambda: next(times),
            timestamp_factory=lambda: "2026-10-06T00:00:00.000Z",
        )

        self.assertEqual(result["httpStatus"], 503)
        self.assertEqual(result["responseTimeMs"], 250)
        self.assertFalse(result["success"])

    def test_connection_error_has_no_http_status(self):
        times = iter([30.0, 30.1])

        def fail_request(_request, timeout):
            raise URLError("connection refused")

        result = probe_target(
            {
                "serviceId": "example-site",
                "url": "https://example.com",
            },
            "eu-north-1",
            5,
            open_url=fail_request,
            clock=lambda: next(times),
            timestamp_factory=lambda: "2026-10-06T00:00:00.000Z",
        )

        self.assertIsNone(result["httpStatus"])
        self.assertEqual(result["responseTimeMs"], 100)
        self.assertFalse(result["success"])

    def test_submits_probe_with_bearer_token(self):
        captured = {}

        def capture_request(request, timeout):
            captured["request"] = request
            captured["timeout"] = timeout
            return FakeResponse(201, b'{"stored":true}')

        probe = {
            "serviceId": "example-site",
            "region": "eu-north-1",
            "checkedAt": "2026-10-06T00:00:00.000Z",
            "httpStatus": 200,
            "responseTimeMs": 120,
            "success": True,
        }

        submit_probe(
            "http://status-api/api/probes",
            "test-token",
            probe,
            open_url=capture_request,
        )

        request = captured["request"]

        self.assertEqual(request.get_method(), "POST")
        self.assertEqual(request.get_header("Authorization"), "Bearer test-token")
        self.assertEqual(json.loads(request.data), probe)
        self.assertEqual(captured["timeout"], 10)

    def test_loads_valid_configuration(self):
        config = load_config(
            {
                "PROBE_TOKEN": "test-token",
                "PROBE_TARGETS_JSON": json.dumps(
                    [
                        {
                            "serviceId": "example-site",
                            "url": "https://example.com",
                        }
                    ]
                ),
            }
        )

        self.assertEqual(config.interval_seconds, 60)
        self.assertEqual(config.timeout_seconds, 5)
        self.assertEqual(config.region, "eu-north-1")
        self.assertEqual(len(config.targets), 1)


if __name__ == "__main__":
    unittest.main()
