"""CIPHER face inference service.

Stateless. Pure inference. Pre-loads the InsightFace model at startup so the
first request after deploy doesn't pay the ~30-60s cold start. Image base64
in, embedding + quality + bbox out. No DB. No business logic. No auth on the
endpoint itself — the FastAPI orchestration layer is responsible for that.

Run locally:
    uvicorn main:app --host 0.0.0.0 --port 8001
"""

from __future__ import annotations

import base64
import logging
import os
from contextlib import asynccontextmanager

import psutil
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

import face_service

log = logging.getLogger("inference")
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

SERVICE_VERSION = "0.1.0"
RECOGNIZER_IMPL = os.getenv("RECOGNIZER_IMPL", "insightface")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    face_service.load_model()
    yield


app = FastAPI(
    title="CIPHER Face Inference",
    version=SERVICE_VERSION,
    lifespan=lifespan,
)


class InferRequest(BaseModel):
    image_base64: str = Field(..., min_length=16)


@app.get("/health")
def health():
    mem = psutil.virtual_memory()
    return {
        "status": "ok" if face_service.is_loaded() else "starting",
        "model_loaded": face_service.is_loaded(),
        "recognizer_impl": RECOGNIZER_IMPL,
        "memory_percent": mem.percent,
        "version": SERVICE_VERSION,
    }


@app.post("/infer")
def infer(req: InferRequest):
    if not face_service.is_loaded():
        return JSONResponse(
            status_code=503,
            content={"success": False, "error": "model_not_loaded"},
        )

    payload = req.image_base64
    if "," in payload[:64]:
        payload = payload.split(",", 1)[1]

    try:
        image_bytes = base64.b64decode(payload, validate=False)
    except Exception:
        raise HTTPException(status_code=400, detail="invalid_base64")

    if not image_bytes:
        raise HTTPException(status_code=400, detail="empty_image")

    result = face_service.detect_and_embed(image_bytes)

    if not result.get("success"):
        log.info(
            "infer error=%s inference_ms=%.1f",
            result.get("error"),
            result.get("inference_ms", 0.0),
        )
        return JSONResponse(status_code=200, content=result)

    log.info(
        "infer ok quality=%.2f face_ratio=%.2f inference_ms=%.1f",
        result["quality_score"],
        result["face_ratio"],
        result["inference_ms"],
    )
    return result
