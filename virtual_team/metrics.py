"""Prometheus RED metrics for HTTP endpoint observability."""

from prometheus_client import Counter, Histogram, generate_latest
from starlette.responses import Response

http_requests_total = Counter(
    "http_requests_total",
    "Total HTTP requests",
    labelnames=["method", "endpoint", "status"],
)

http_request_duration_seconds = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    labelnames=["method", "endpoint"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
)

http_errors_total = Counter(
    "http_errors_total",
    "Total HTTP errors",
    labelnames=["method", "endpoint"],
)


def metrics_endpoint():
    """Return Prometheus metrics in text format."""
    return Response(content=generate_latest(), media_type="text/plain; charset=utf-8")
