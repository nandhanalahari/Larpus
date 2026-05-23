"""Face embedding service.

Production path uses InsightFace (`buffalo_l`) to detect faces and produce
512-dimensional normalized embeddings. If InsightFace is not installed
(common on local Macs without C++ build tools) we fall back to a deterministic
stub: SHA-512 of the decoded image bytes mapped to a unit vector.

The stub gives identical-image-in -> identical-vector-out, which keeps the
enrollment + recognize loop usable end-to-end without the heavy ONNX install.
It is NOT real biometric matching — point the same photo at the scanner to
demonstrate the pipeline, then swap in `requirements-full.txt` for real usage.
"""

from __future__ import annotations

import base64
import hashlib
import io
import math
import numpy as np

from config import get_settings

EMBEDDING_DIM = 512

_face_app = None
_insightface_available = False
_load_error: str | None = None

try:
    from PIL import Image
    import cv2
    from insightface.app import FaceAnalysis  # type: ignore
    _insightface_available = True
except ImportError as exc:  # pragma: no cover
    _load_error = f"insightface not installed: {exc}"
    print(f"[face_service] {_load_error} — running in deterministic stub mode")


def load_model() -> None:
    """Eagerly load the buffalo_l weights on server start."""
    global _face_app, _load_error
    if not _insightface_available:
        return

    settings = get_settings()
    print(f"[face_service] loading InsightFace model: {settings.insightface_model}")
    try:
        _face_app = FaceAnalysis(
            name=settings.insightface_model,
            root="./insightface_models",
            providers=["CPUExecutionProvider"],
        )
        _face_app.prepare(ctx_id=0, det_size=(640, 640))
        print("[face_service] InsightFace ready")
    except Exception as exc:  # pragma: no cover
        _face_app = None
        _load_error = f"InsightFace load failed: {exc}"
        print(f"[face_service] {_load_error} — falling back to stub")


def is_model_loaded() -> bool:
    return _face_app is not None


def model_status() -> dict:
    return {
        "insightface_installed": _insightface_available,
        "model_loaded": _face_app is not None,
        "embedding_dim": EMBEDDING_DIM,
        "mode": "insightface" if _face_app is not None else "deterministic_stub",
        "error": _load_error,
    }


def _decode_image(image_base64: str) -> bytes:
    # Strip optional `data:image/...;base64,` prefix.
    if "," in image_base64 and image_base64[:11] == "data:image/":
        image_base64 = image_base64.split(",", 1)[1]
    return base64.b64decode(image_base64, validate=False)


def get_embedding(image_base64: str) -> list[float] | None:
    """Return a 512-dim unit vector for the largest face in the image.

    Returns None if InsightFace is available but no face was detected.
    Returns a deterministic stub vector if InsightFace isn't installed
    (so the rest of the pipeline can be exercised end-to-end).
    """
    img_bytes = _decode_image(image_base64)

    if _face_app is None:
        return _stub_embedding(img_bytes)

    try:
        pil_image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        cv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
        faces = _face_app.get(cv_image)
    except Exception as exc:  # pragma: no cover
        print(f"[face_service] decode/detect failed: {exc}")
        return None

    if not faces:
        return None

    largest = max(
        faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1])
    )
    return largest.normed_embedding.astype(float).tolist()


def get_all_embeddings(image_base64: str) -> list[dict]:
    """Return embeddings for every face in the image with bounding boxes."""
    img_bytes = _decode_image(image_base64)

    if _face_app is None:
        emb = _stub_embedding(img_bytes)
        return [{"embedding": emb, "bbox": [0, 0, 100, 100], "det_score": 0.99}]

    try:
        pil_image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        cv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
        faces = _face_app.get(cv_image)
    except Exception as exc:  # pragma: no cover
        print(f"[face_service] decode/detect failed: {exc}")
        return []

    out: list[dict] = []
    for face in faces:
        out.append(
            {
                "embedding": face.normed_embedding.astype(float).tolist(),
                "bbox": face.bbox.tolist(),
                "det_score": float(face.det_score),
            }
        )
    return out


def _stub_embedding(image_bytes: bytes) -> list[float]:
    """Deterministic 512-d unit vector derived from image content.

    Uses a chained SHA-512 hash so identical input bytes always produce the
    same vector. Lets the rest of the system (enrollment, vector search,
    recognition) run without InsightFace installed.
    """
    floats: list[float] = []
    h = hashlib.sha512(image_bytes).digest()
    counter = 0
    while len(floats) < EMBEDDING_DIM:
        # Step: hash again to extend the pseudo-random stream.
        h = hashlib.sha512(h + counter.to_bytes(4, "big")).digest()
        counter += 1
        # Each 4-byte chunk -> a signed float in [-1, 1].
        for i in range(0, len(h), 4):
            if len(floats) >= EMBEDDING_DIM:
                break
            chunk = int.from_bytes(h[i : i + 4], "big", signed=False)
            floats.append((chunk / 0xFFFFFFFF) * 2.0 - 1.0)

    vec = np.array(floats, dtype=np.float32)
    norm = float(np.linalg.norm(vec))
    if norm < 1e-6 or math.isnan(norm):
        # Should never happen, but be safe.
        vec = np.ones(EMBEDDING_DIM, dtype=np.float32) / math.sqrt(EMBEDDING_DIM)
        norm = 1.0
    return (vec / norm).astype(float).tolist()
