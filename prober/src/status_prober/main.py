import json
import os
import socket
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


@dataclass(frozen=True)
class Config:
    api_url: str
    token: str
    region: str
    interval_seconds: int
    timeout_seconds: int
    targets: list[dict[str, str]]


def utc_timestamp():
    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def validate_http_url(value):
    parsed = urlparse(value)

    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError(f"Invalid HTTP URL: {value}")


def load_config(environment=None):
    env = environment if environment is not None else os.environ

    api_url = env.get(
        "PROBE_API_URL",
        "http://status-api.status-platform.svc.cluster.local/api/probes",
    )
    token = env.get("PROBE_TOKEN", "")
    region = env.get("PROBE_REGION", "eu-north-1")
    interval_seconds = int(env.get("PROBE_INTERVAL_SECONDS", "60"))
    timeout_seconds = int(env.get("PROBE_TIMEOUT_SECONDS", "5"))

    if not token:
        raise ValueError("PROBE_TOKEN is required.")

    if interval_seconds <= 0:
        raise ValueError("PROBE_INTERVAL_SECONDS must be positive.")

    if timeout_seconds <= 0:
        raise ValueError("PROBE_TIMEOUT_SECONDS must be positive.")

    validate_http_url(api_url)

    try:
        targets = json.loads(env.get("PROBE_TARGETS_JSON", "[]"))
    except json.JSONDecodeError as error:
        raise ValueError("PROBE_TARGETS_JSON must contain valid JSON.") from error

    if not isinstance(targets, list) or not targets:
        raise ValueError("PROBE_TARGETS_JSON must contain at least one target.")

    service_ids = set()

    for target in targets:
        if not isinstance(target, dict):
            raise ValueError("Each probe target must be an object.")

        service_id = target.get("serviceId")
        target_url = target.get("url")

        if not isinstance(service_id, str) or not service_id:
            raise ValueError("Each target requires a serviceId.")

        if service_id in service_ids:
            raise ValueError(f"Duplicate serviceId: {service_id}")

        if not isinstance(target_url, str):
            raise ValueError(f"Target {service_id} requires a URL.")

        validate_http_url(target_url)
        service_ids.add(service_id)

    return Config(
        api_url=api_url,
        token=token,
        region=region,
        interval_seconds=interval_seconds,
        timeout_seconds=timeout_seconds,
        targets=targets,
    )


def probe_target(
    target,
    region,
    timeout_seconds,
    *,
    open_url=urlopen,
    clock=time.perf_counter,
    timestamp_factory=utc_timestamp,
):
    started_at = clock()
    http_status = None
    success = False

    request = Request(
        target["url"],
        headers={
            "User-Agent": "status-platform-prober/0.1",
            "Accept": "*/*",
        },
        method="GET",
    )

    try:
        with open_url(request, timeout=timeout_seconds) as response:
            http_status = response.getcode()
            response.read(1)
            success = 200 <= http_status <= 399
    except HTTPError as error:
        http_status = error.code
        success = 200 <= http_status <= 399
        error.close()
    except (URLError, TimeoutError, socket.timeout, OSError):
        http_status = None
        success = False

    response_time_ms = max(0, round((clock() - started_at) * 1000))

    return {
        "serviceId": target["serviceId"],
        "region": region,
        "checkedAt": timestamp_factory(),
        "httpStatus": http_status,
        "responseTimeMs": response_time_ms,
        "success": success,
    }


def submit_probe(api_url, token, probe, *, open_url=urlopen):
    request = Request(
        api_url,
        data=json.dumps(probe).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )

    with open_url(request, timeout=10) as response:
        response_body = response.read().decode("utf-8")
        status = response.getcode()

    if status < 200 or status > 299:
        raise RuntimeError(
            f"Probe API returned HTTP {status}: {response_body}"
        )


def run_cycle(config):
    for target in config.targets:
        probe = probe_target(
            target,
            config.region,
            config.timeout_seconds,
        )

        outcome = "success" if probe["success"] else "failure"

        print(
            f'{probe["checkedAt"]} '
            f'{probe["serviceId"]} '
            f'{outcome} '
            f'{probe["responseTimeMs"]}ms',
            flush=True,
        )

        try:
            submit_probe(config.api_url, config.token, probe)
        except Exception as error:
            print(
                f'Failed to submit result for {probe["serviceId"]}: {error}',
                file=sys.stderr,
                flush=True,
            )


def main():
    config = load_config()

    print(
        f"Starting prober in {config.region} with "
        f"{len(config.targets)} target(s).",
        flush=True,
    )

    while True:
        cycle_started_at = time.monotonic()

        run_cycle(config)

        elapsed = time.monotonic() - cycle_started_at
        remaining = max(0, config.interval_seconds - elapsed)

        time.sleep(remaining)


if __name__ == "__main__":
    main()
