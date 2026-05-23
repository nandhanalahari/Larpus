"""Transparent proxy to the upstream production backend.

Local dev box can't run InsightFace, so we forward face/voice/contact/payment
calls to the deployed server while keeping ledger/transactions writes local
(where this process has direct MongoDB access to the Kolana Atlas cluster).

Paths handled here are mounted with explicit prefixes from main.py.
"""

from __future__ import annotations

import logging
from typing import Iterable

import httpx
from fastapi import APIRouter, Request, Response

from config import get_settings
from database import get_ledger_collection, get_transactions_collection

log = logging.getLogger("inference.proxy")

router = APIRouter()

# Headers we strip when relaying (hop-by-hop or rewritten by httpx).
_HOP_BY_HOP = {
    "host",
    "content-length",
    "connection",
    "keep-alive",
    "transfer-encoding",
    "upgrade",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
}

_REQUEST_TIMEOUT = 60.0


def _filtered_headers(headers, drop: Iterable[str] = ()) -> dict[str, str]:
    drop_set = _HOP_BY_HOP | {h.lower() for h in drop}
    return {k: v for k, v in headers.items() if k.lower() not in drop_set}


async def _forward(request: Request, suffix: str) -> Response:
    """Proxy `request` to `<upstream_api_base>/<suffix>`."""
    settings = get_settings()
    upstream = settings.upstream_api_base.rstrip("/")
    url = f"{upstream}/{suffix.lstrip('/')}"

    body = await request.body()
    headers = _filtered_headers(request.headers)

    async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT) as client:
        try:
            upstream_resp = await client.request(
                request.method,
                url,
                params=request.query_params,
                content=body,
                headers=headers,
            )
        except httpx.HTTPError as e:
            log.warning("proxy upstream error %s %s: %s", request.method, url, e)
            return Response(
                content=f'{{"detail":"upstream {url} unreachable: {e}"}}',
                status_code=502,
                media_type="application/json",
            )

    relay_headers = _filtered_headers(upstream_resp.headers, drop=("content-encoding",))
    return Response(
        content=upstream_resp.content,
        status_code=upstream_resp.status_code,
        headers=relay_headers,
        media_type=upstream_resp.headers.get("content-type"),
    )


async def _mirror_payment_response(payload: bytes) -> None:
    """If the upstream /payments/execute returned a confirmed tx, mirror it
    into our local MongoDB so the ledger / history / popup stay accurate.

    Best-effort: never raises.
    """
    try:
        import json
        import time

        data = json.loads(payload.decode("utf-8")) if payload else {}
        if not isinstance(data, dict):
            return
        if data.get("status") != "paid":
            return
        signature = data.get("transaction_signature")
        if not signature:
            return

        from_wallet = data.get("from_wallet")
        to_wallet = data.get("to_wallet")
        if not from_wallet or not to_wallet:
            # /payments/execute response doesn't include wallets; skip mirror.
            return

        from services.solana_history import record_confirmed_transfer

        await record_confirmed_transfer(
            signature=signature,
            from_wallet=from_wallet,
            to_wallet=to_wallet,
            amount_sol=float(data.get("amount_sol", 0.0)),
            amount_usd=None,
            block_time=int(time.time()),
        )
        log.info("proxy mirrored upstream payment signature=%s", signature)
    except Exception as e:
        log.warning("proxy mirror failed: %s", e)


@router.api_route(
    "/recognize",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def proxy_recognize(request: Request) -> Response:
    return await _forward(request, "recognize")



@router.api_route(
    "/contacts",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def proxy_contacts_root(request: Request) -> Response:
    return await _forward(request, "contacts")


@router.api_route(
    "/contacts/{rest:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def proxy_contacts(request: Request, rest: str) -> Response:
    return await _forward(request, f"contacts/{rest}")


@router.api_route(
    "/payments/{rest:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def proxy_payments(request: Request, rest: str) -> Response:
    resp = await _forward(request, f"payments/{rest}")
    if rest.endswith("execute") and 200 <= resp.status_code < 300:
        await _mirror_payment_response(resp.body)
    return resp
