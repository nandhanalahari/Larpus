"""Pluggable face recognizer interface.

This is the file your teammate edits. Everything else in the service
(FastAPI app, base64 handling, quality scoring, error contract, Docker, health
checks) is generic plumbing that does not care which algorithm produces the
embedding.

To plug in a custom algorithm:
    1. Implement a class that satisfies the `Recognizer` protocol below.
    2. Set RECOGNIZER_IMPL to point at it (or replace the default).
    3. Restart the service. That's it.

The wrapper layer (face_service.py) handles base64 decoding, image-size
guards, quality scoring, and mapping your output to the public API. You only
need to produce: did I find a face, where was it, what is the embedding.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Protocol

import numpy as np

log = logging.getLogger("inference.recognizer")

EMBEDDING_DIM = 512


@dataclass
class EncodeResult:
    """What a Recognizer.encode() call returns.

    success=True means exactly one face was found and an embedding was
    produced. Anything else (no face, multiple faces, internal failure) is a
    failure with a specific `error` code.
    """

    success: bool
    error: str | None = None
    embedding: list[float] | None = None
    bbox: dict | None = None
    face_count: int = 0
    extra_boxes: list[dict] | None = None


class Recognizer(Protocol):
    """Contract every recognizer implementation must satisfy."""

    def load(self) -> None:
        """Called once at service startup. Block until ready."""

    def is_ready(self) -> bool:
        """True iff load() has completed and encode() can be called."""

    def encode(self, image_bgr: np.ndarray) -> EncodeResult:
        """Run detection + embedding on a single BGR image.

        Input: image_bgr is a numpy array of shape (H, W, 3), dtype uint8,
        channel order BGR (OpenCV convention).

        Output: EncodeResult.
          - On success: embedding is a list of 512 floats, bbox is
            {x, y, w, h} in pixel coords relative to the input image.
          - On no face: success=False, error="no_face_detected", face_count=0.
          - On multiple faces: success=False, error="multiple_faces",
            face_count=N, extra_boxes=[{x,y,w,h}, ...].
          - On internal failure: success=False, error="embedding_failed".
        """


# ---------------------------------------------------------------------------
# Default implementation: InsightFace buffalo_l
#
# This is a working reference impl so the service runs end-to-end without
# waiting on the teammate's algorithm. When the teammate's code is ready,
# either replace this class or set RECOGNIZER_IMPL=cipher.MyRecognizer and
# import it.
# ---------------------------------------------------------------------------


class InsightFaceRecognizer:
    def __init__(self, model_name: str = "buffalo_l") -> None:
        self.model_name = model_name
        self._app = None

    def load(self) -> None:
        if self._app is not None:
            return
        from insightface.app import FaceAnalysis

        log.info("InsightFaceRecognizer: loading model=%s", self.model_name)
        app = FaceAnalysis(name=self.model_name, providers=["CPUExecutionProvider"])
        app.prepare(ctx_id=0, det_size=(640, 640))
        self._app = app
        log.info("InsightFaceRecognizer: ready")

    def is_ready(self) -> bool:
        return self._app is not None

    def encode(self, image_bgr: np.ndarray) -> EncodeResult:
        if self._app is None:
            return EncodeResult(success=False, error="model_not_loaded")

        faces = self._app.get(image_bgr)

        if not faces:
            return EncodeResult(success=False, error="no_face_detected", face_count=0)

        boxes = []
        for f in faces:
            x1, y1, x2, y2 = f.bbox.astype(int)
            boxes.append(
                {"x": int(x1), "y": int(y1), "w": int(x2 - x1), "h": int(y2 - y1)}
            )

        if len(faces) > 1:
            return EncodeResult(
                success=False,
                error="multiple_faces",
                face_count=len(faces),
                extra_boxes=boxes,
            )

        emb = faces[0].normed_embedding
        if emb is None or len(emb) != EMBEDDING_DIM:
            return EncodeResult(success=False, error="embedding_failed", face_count=1, bbox=boxes[0])

        return EncodeResult(
            success=True,
            embedding=emb.astype(float).tolist(),
            bbox=boxes[0],
            face_count=1,
        )


# ---------------------------------------------------------------------------
# Active recognizer (module-level singleton).
#
# Swap this to your teammate's implementation when ready:
#   from cipher.my_recognizer import MyRecognizer
#   recognizer = MyRecognizer()
# ---------------------------------------------------------------------------

_recognizer_name = os.getenv("RECOGNIZER_IMPL", "insightface").lower()

if _recognizer_name == "insightface":
    recognizer: Recognizer = InsightFaceRecognizer(
        model_name=os.getenv("INSIGHTFACE_MODEL", "buffalo_l")
    )
else:
    raise RuntimeError(
        f"Unknown RECOGNIZER_IMPL={_recognizer_name!r}. "
        f"Either set it to 'insightface' or import + instantiate your own."
    )
