"""Smoke test for /infer.

Posts a base64-encoded image and validates the response shape. Pass either
a file path or a URL. Default points at localhost:8001.

Usage:
    python test_infer.py path/to/face.jpg
    python test_infer.py path/to/face.jpg --url https://your-endpoint/infer
"""

from __future__ import annotations

import argparse
import base64
import json
import sys
import time
import urllib.request


def encode(path: str) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("ascii")


def post(url: str, body: dict) -> tuple[int, dict]:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.status, json.loads(resp.read().decode("utf-8"))


def validate(payload: dict) -> list[str]:
    errors = []
    if not isinstance(payload, dict):
        return ["response is not an object"]
    if "success" not in payload:
        errors.append("missing 'success' field")
        return errors
    if payload["success"]:
        emb = payload.get("embedding")
        if not isinstance(emb, list) or len(emb) != 512:
            errors.append(f"embedding must be a list of 512 floats (got {type(emb).__name__})")
        bbox = payload.get("bounding_box")
        if not isinstance(bbox, dict) or set(bbox or {}) < {"x", "y", "w", "h"}:
            errors.append("bounding_box missing x/y/w/h")
        q = payload.get("quality_score")
        if not isinstance(q, (int, float)) or not 0.0 <= q <= 1.0:
            errors.append("quality_score must be a float in [0,1]")
    else:
        if "error" not in payload:
            errors.append("failure response missing 'error' code")
    return errors


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("image", help="Path to a JPEG/PNG with one face")
    p.add_argument("--url", default="http://localhost:8001/infer")
    p.add_argument("--health", default="http://localhost:8001/health")
    args = p.parse_args()

    try:
        with urllib.request.urlopen(args.health, timeout=10) as resp:
            health = json.loads(resp.read().decode("utf-8"))
            print(f"[health] {health}")
            if not health.get("model_loaded"):
                print("  WARN: model not loaded yet")
    except Exception as e:
        print(f"[health] failed: {e}")
        return 2

    image_b64 = encode(args.image)
    print(f"[infer] sending {len(image_b64):,} chars of base64 to {args.url}")

    t0 = time.perf_counter()
    status, payload = post(args.url, {"image_base64": image_b64})
    elapsed_ms = (time.perf_counter() - t0) * 1000.0
    print(f"[infer] http={status} round_trip={elapsed_ms:.1f}ms")
    print(json.dumps({k: v for k, v in payload.items() if k != "embedding"}, indent=2))

    if payload.get("success"):
        emb = payload["embedding"]
        print(f"[infer] embedding: len={len(emb)} sample={emb[:4]}")

    errors = validate(payload)
    if errors:
        print("[FAIL] response validation errors:")
        for e in errors:
            print(f"  - {e}")
        return 1

    print("[OK] response shape is valid")
    return 0


if __name__ == "__main__":
    sys.exit(main())
