# Handoff: Plugging In Your Face Recognition Algorithm

This service runs end-to-end **right now** using InsightFace `buffalo_l` as
a reference implementation. When your custom algorithm is ready, swapping
it in touches **one file**: [recognizer.py](recognizer.py).

You do not need to touch:
- `main.py` — FastAPI app, lifespan, /infer, /health
- `face_service.py` — base64 decoding, quality scoring, size checks, error mapping
- `Dockerfile`, `requirements.txt`, deployment config

## What you need to deliver

A Python class that implements three methods:

```python
class MyRecognizer:
    def load(self) -> None:
        """Called once at service startup. Block until ready.
        Load model weights, allocate tensors, warm up — whatever you need."""

    def is_ready(self) -> bool:
        """Return True iff load() finished and encode() is safe to call."""

    def encode(self, image_bgr: np.ndarray) -> EncodeResult:
        """Take one BGR image, return an EncodeResult."""
```

## Input contract

`encode()` receives a single argument:

- `image_bgr`: a numpy array of shape `(H, W, 3)`, dtype `uint8`, channel
  order **BGR** (OpenCV convention).
- The image has already been decoded from base64 and size-checked.
- No preprocessing has been applied (no resize, no normalization).
  Do whatever your model needs internally.

## Output contract

Return an `EncodeResult` (defined in [recognizer.py](recognizer.py)):

```python
@dataclass
class EncodeResult:
    success: bool
    error: str | None = None
    embedding: list[float] | None = None   # length 512 on success
    bbox: dict | None = None               # {"x", "y", "w", "h"} on success
    face_count: int = 0
    extra_boxes: list[dict] | None = None
```

### Success case
- `success = True`
- `embedding` = a Python list of exactly **512 floats**
- `bbox` = `{"x": int, "y": int, "w": int, "h": int}` in pixel coords of the input image
- `face_count = 1`

### Failure cases (use these exact error strings)

| `error` | When to use |
|---|---|
| `"no_face_detected"` | Detector found zero faces. Set `face_count=0`. |
| `"multiple_faces"` | Detector found > 1 face. Set `face_count=N` and `extra_boxes=[{x,y,w,h}, ...]` for every face found. |
| `"embedding_failed"` | One face was found but embedding extraction failed internally. |
| `"model_not_loaded"` | `encode()` called before `load()` finished. |

**Do not raise exceptions.** Catch internal errors and return
`success=False, error="embedding_failed"` instead. The wrapper layer turns
exceptions into 500s, which the mobile won't render gracefully.

## What you do NOT need to handle

The wrapper layer ([face_service.py](face_service.py)) handles these
**after** your `encode()` returns — do not duplicate them:

- ❌ Base64 decoding
- ❌ Image size limit (2 MB cap)
- ❌ Face-too-small check (compares your bbox to frame area, returns `face_too_small`)
- ❌ Quality scoring (Laplacian sharpness + brightness)
- ❌ Timing/logging
- ❌ Mapping to the public JSON API

You can return a valid embedding for a tiny or blurry face — the wrapper
will reject it with the appropriate error code before it reaches the
orchestration layer. You're responsible for detection + embedding only.

## How to plug in

In [recognizer.py](recognizer.py), at the bottom:

```python
# Replace this block:
recognizer: Recognizer = InsightFaceRecognizer(...)

# With this:
from your_module import MyRecognizer
recognizer: Recognizer = MyRecognizer()
```

If your module needs custom dependencies, add them to
[requirements.txt](requirements.txt) and update the
[Dockerfile](Dockerfile) if you need any system libs (Debian package names
go after `libgl1`).

## Test before you hand off

```bash
# 1. Service starts cleanly
uvicorn main:app --host 0.0.0.0 --port 8001

# 2. /health reports model_loaded: true within ~30s
curl http://localhost:8001/health

# 3. Smoke test against a real face photo
python test_infer.py path/to/face.jpg
```

The smoke test validates:
- Embedding is a list of exactly 512 floats
- Bounding box has x/y/w/h integer fields
- Quality score is in [0, 1]

If [test_infer.py](test_infer.py) prints `[OK]`, you're done.

## Embedding dimensionality

The MongoDB Atlas Vector Search index is configured for **512 dimensions**
with cosine similarity. If your model produces a different size (e.g., 128
or 1024), tell the FastAPI orchestration dev so they can rebuild the index
— this is not free, it takes 5–30 minutes on Atlas.

Prefer 512 if you have a choice. Match the InsightFace convention so we
don't need to touch the database.

## Questions

If the contract above doesn't fit your algorithm cleanly, talk to me before
working around it — I'd rather adjust the wrapper than have you write
glue code.
