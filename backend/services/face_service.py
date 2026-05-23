import base64
import io
import numpy as np
from config import get_settings

_face_app = None
_insightface_available = False

try:
    from PIL import Image
    import cv2
    from insightface.app import FaceAnalysis
    _insightface_available = True
except ImportError:
    print("[InsightFace] Not installed -- running in stub mode (no face recognition)")


def load_model():
    global _face_app
    if not _insightface_available:
        print("[InsightFace] Skipped model load (insightface not installed)")
        return

    settings = get_settings()
    print(f"[InsightFace] Loading model: {settings.insightface_model}")
    _face_app = FaceAnalysis(
        name=settings.insightface_model,
        root="./insightface_models",
        providers=["CPUExecutionProvider"],
    )
    _face_app.prepare(ctx_id=0, det_size=(640, 640))
    print("[InsightFace] Model loaded")


def is_model_loaded() -> bool:
    return _face_app is not None


def get_embedding(image_base64: str) -> list[float] | None:
    """Decode a base64 image, detect faces, return the 512-dim embedding of the largest face."""
    if not _insightface_available or _face_app is None:
        return _stub_embedding()

    image_data = base64.b64decode(image_base64)
    pil_image = Image.open(io.BytesIO(image_data)).convert("RGB")
    cv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)

    faces = _face_app.get(cv_image)

    if not faces:
        return None

    largest = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    embedding = largest.normed_embedding.tolist()
    return embedding


def get_all_embeddings(image_base64: str) -> list[dict]:
    """Return embeddings for all detected faces with bounding boxes."""
    if not _insightface_available or _face_app is None:
        return [{"embedding": _stub_embedding(), "bbox": [0, 0, 100, 100], "det_score": 0.99}]

    image_data = base64.b64decode(image_base64)
    pil_image = Image.open(io.BytesIO(image_data)).convert("RGB")
    cv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)

    faces = _face_app.get(cv_image)

    results = []
    for face in faces:
        results.append({
            "embedding": face.normed_embedding.tolist(),
            "bbox": face.bbox.tolist(),
            "det_score": float(face.det_score),
        })
    return results


def _stub_embedding() -> list[float]:
    """Return a random 512-dim embedding for local testing without InsightFace."""
    vec = np.random.randn(512).astype(np.float32)
    vec = vec / np.linalg.norm(vec)
    return vec.tolist()
