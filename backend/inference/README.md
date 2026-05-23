# CIPHER Face Inference Service

Stateless face recognition service. Takes a base64-encoded image, returns a
512-dim face embedding plus quality metadata. Deployed to DigitalOcean
Gradient AI as a serverless inference endpoint. Called internally by the
FastAPI orchestration layer — **never exposed directly to the mobile app**.

## Contract

### `POST /infer`

Request:
```json
{ "image_base64": "<base64 JPEG or PNG, optionally with data: prefix>" }
```

Success response (HTTP 200):
```json
{
  "success": true,
  "embedding": [0.012, -0.184, ...],   // 512 floats
  "bounding_box": { "x": 120, "y": 80, "w": 240, "h": 240 },
  "quality_score": 0.91,
  "face_ratio": 0.22,
  "inference_ms": 98.4
}
```

Failure responses (HTTP 200, `success: false`):

| `error` | Meaning |
|---|---|
| `invalid_image` | Could not decode the base64 as an image |
| `no_face_detected` | InsightFace found nothing |
| `multiple_faces` | More than one face in frame — `boxes[]` returned for tap-to-select |
| `face_too_small` | Face occupies < 5% of frame — `face_ratio` returned |
| `low_quality` | Composite sharpness/brightness below threshold — `quality_score` returned |
| `embedding_failed` | Face detected but embedding extraction failed |
| `model_not_loaded` | Service is still warming up (HTTP 503) |

HTTP 400 is reserved for malformed requests (missing base64, invalid encoding).

### `GET /health`

```json
{
  "status": "ok",
  "model_loaded": true,
  "model_name": "buffalo_l",
  "memory_percent": 42.1,
  "version": "0.1.0"
}
```

## Run locally

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001
```

First run downloads the `buffalo_l` model (~280 MB) to `~/.insightface/`.
Subsequent runs are instant.

## Smoke test

```bash
python test_infer.py path/to/face.jpg
```

Validates:
- `/health` reports `model_loaded: true`
- Response is HTTP 200 with `success: true`
- Embedding is exactly 512 floats
- Bounding box has x/y/w/h
- `quality_score` is in [0, 1]

## Deploy to Gradient AI

1. Build the image:
   ```bash
   docker build -t cipher-inference:0.1.0 .
   ```
2. Push to a registry Gradient AI can pull from (DigitalOcean Container Registry recommended).
3. In Gradient AI, create an inference endpoint pointing at the image. Expose port 8001.
4. Configure health check path: `/health`.
5. Once deployed, grab the endpoint URL and pass it to the FastAPI orchestration layer as `INFERENCE_URL`.

The Dockerfile pre-downloads the buffalo_l model at **build time**, so cold
starts only pay model load (~5s), not model download (~30-60s).

## Thresholds (in `face_service.py`)

- `MIN_FACE_RATIO = 0.05` — face must fill at least 5% of the frame
- `LOW_QUALITY_THRESHOLD = 0.30` — composite of sharpness + brightness
- `MAX_IMAGE_BYTES = 2 MB` — abuse guard

Tune these once you've seen real frames from the mobile camera.

## What this service does NOT do

- No MongoDB access. No vector search. The orchestration layer does that.
- No confidence threshold logic. The orchestration layer applies 0.85 / 0.60.
- No authentication. The orchestration layer must keep this endpoint
  network-isolated or behind a shared secret.
- No request throttling. Mobile should be throttling at the source.
