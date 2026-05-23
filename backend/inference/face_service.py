"""Generic wrapper around whatever Recognizer is plugged in.

Owns the things that are independent of the face recognition algorithm:
  - base64 / bytes -> numpy BGR image
  - image size cap (anti-abuse)
  - face-too-small check (uses bbox + frame area)
  - quality scoring (Laplacian sharpness + brightness composite)
  - timing
  - mapping recognizer output -> public API response shape

The algorithm itself lives in recognizer.py. Editing this file is rarely
necessary when swapping algorithms.
"""

from __future__ import annotations

import io
import logging
import time
from typing import Any

import cv2
import numpy as np
from PIL import Image

from recognizer import recognizer

log = logging.getLogger("inference.face")

MIN_FACE_RATIO = 0.05
LOW_QUALITY_THRESHOLD = 0.30
MAX_IMAGE_BYTES = 2 * 1024 * 1024


def load_model() -> None:
    recognizer.load()


def is_loaded() -> bool:
    return recognizer.is_ready()


def _decode_image(data: bytes) -> np.ndarray | None:
    if len(data) > MAX_IMAGE_BYTES:
        return None
    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
        arr = np.array(img)
        return cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
    except Exception:
        return None


def _sharpness(gray: np.ndarray) -> float:
    lap = cv2.Laplacian(gray, cv2.CV_64F).var()
    return float(min(1.0, lap / 500.0))


def _brightness(gray: np.ndarray) -> float:
    mean = float(gray.mean())
    if mean < 40 or mean > 220:
        return 0.2
    if mean < 70 or mean > 190:
        return 0.6
    return 1.0


def _quality(image_bgr: np.ndarray, bbox: dict) -> float:
    x, y, w, h = bbox["x"], bbox["y"], bbox["w"], bbox["h"]
    crop = image_bgr[max(0, y) : y + h, max(0, x) : x + w]
    if crop.size == 0:
        return 0.0
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    return float(min(_sharpness(gray), _brightness(gray)))


def detect_and_embed(image_bytes: bytes) -> dict[str, Any]:
    if not recognizer.is_ready():
        return {"success": False, "error": "model_not_loaded"}

    img = _decode_image(image_bytes)
    if img is None:
        return {"success": False, "error": "invalid_image"}

    h, w = img.shape[:2]
    frame_area = float(h * w)

    t0 = time.perf_counter()
    result = recognizer.encode(img)
    inference_ms = (time.perf_counter() - t0) * 1000.0

    if not result.success:
        out: dict[str, Any] = {
            "success": False,
            "error": result.error,
            "inference_ms": inference_ms,
        }
        if result.error == "multiple_faces":
            out["count"] = result.face_count
            out["boxes"] = result.extra_boxes or []
        return out

    assert result.bbox is not None and result.embedding is not None
    bbox = result.bbox
    face_area = float(bbox["w"] * bbox["h"])
    face_ratio = face_area / frame_area if frame_area > 0 else 0.0

    if face_ratio < MIN_FACE_RATIO:
        return {
            "success": False,
            "error": "face_too_small",
            "face_ratio": face_ratio,
            "inference_ms": inference_ms,
        }

    quality = _quality(img, bbox)
    if quality < LOW_QUALITY_THRESHOLD:
        return {
            "success": False,
            "error": "low_quality",
            "quality_score": quality,
            "inference_ms": inference_ms,
        }

    return {
        "success": True,
        "embedding": result.embedding,
        "bounding_box": bbox,
        "quality_score": quality,
        "face_ratio": face_ratio,
        "inference_ms": inference_ms,
    }
