"""CLI helper to enroll a contact directly via /api/v1/contacts.

Bypasses the mobile onboarding UI for fast testing of the recognition pipeline.

Usage:
    python enroll_contact.py --name "Jamshed" --wallet <solana-address> --owner <your-wallet-address> face.jpg [face2.jpg ...]
    python enroll_contact.py --name "Test" --owner OWNER_WALLET face1.jpg face2.jpg face3.jpg

The owner is the wallet address of the app user (the device owner). Defaults to
'cli-test-user' so you can enroll without a real Solana wallet during testing.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import urllib.request


DEFAULT_BASE_URL = os.getenv("KOLANA_API_URL", "http://134.209.216.232:8000/api/v1")


def encode_file(path: str) -> str:
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("ascii")


def post(url: str, body: dict, timeout: float = 60.0) -> tuple[int, dict | str]:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw)
    except urllib.error.HTTPError as e:
        body_text = e.read().decode("utf-8", errors="replace")
        try:
            return e.code, json.loads(body_text)
        except json.JSONDecodeError:
            return e.code, body_text


def main() -> int:
    p = argparse.ArgumentParser(description="Enroll a contact in the KOLANA backend.")
    p.add_argument("photos", nargs="+", help="One or more JPEG/PNG paths (3 photos recommended)")
    p.add_argument("--name", required=True, help="Contact display name")
    p.add_argument("--owner", default="cli-test-user", help="Owner wallet address / user id")
    p.add_argument("--wallet", default=None, help="Contact's Solana wallet address (optional)")
    p.add_argument("--phone", default=None, help="Contact's phone number (optional)")
    p.add_argument("--url", default=DEFAULT_BASE_URL, help="Backend base URL")
    args = p.parse_args()

    for path in args.photos:
        if not os.path.isfile(path):
            print(f"[ERROR] Not a file: {path}", file=sys.stderr)
            return 2

    images = [encode_file(p) for p in args.photos]
    print(f"[enroll] encoding {len(images)} photo(s)")
    for path, img in zip(args.photos, images):
        print(f"  {path}: {len(img):,} chars base64")

    body = {
        "owner_user_id": args.owner,
        "name": args.name,
        "phone": args.phone,
        "solana_wallet_address": args.wallet,
        "face_images_base64": images,
    }

    url = f"{args.url.rstrip('/')}/contacts"
    print(f"[enroll] POST {url}")
    status, payload = post(url, body)

    print(f"[enroll] HTTP {status}")
    if isinstance(payload, dict):
        print(json.dumps(payload, indent=2))
    else:
        print(payload)

    if status == 201 or status == 200:
        print("[OK] Contact enrolled.")
        return 0
    if status == 400:
        print("[FAIL] Bad request — most likely no face detected in one of the images.")
        return 1
    if status == 409:
        print("[FAIL] Contact with that wallet already exists for this owner.")
        return 1
    print(f"[FAIL] Unexpected status {status}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
