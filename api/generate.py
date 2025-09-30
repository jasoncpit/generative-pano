"""
FastAPI route for proxying image generation requests.

POST `/api/generate` with a JSON body containing a base64 data URL (or raw
base64 string) under `source_image_b64`. The server uploads the bytes to
Replicate and passes a publicly accessible URL to the model.

Providers:
- provider == "replicate": Runs a Replicate pipeline. Requires env `REPLICATE_API_TOKEN`.

The backend normalizes params, uploads the provided base64 image to Replicate,
calls the selected provider, and returns the resulting image bytes. No keys or
images are stored on the server.

Designed for serverless (e.g., Vercel). Runtime/deps in requirements.txt/pyproject.toml.
"""

from fastapi import FastAPI, Request, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os
from typing import Any
import base64
import asyncio
import io
from dotenv import load_dotenv

load_dotenv()

try:
    # Optional import; only needed if provider == replicate
    from replicate.client import Client as ReplicateClient  # type: ignore
except Exception:
    ReplicateClient = None  # type: ignore

app = FastAPI()

# Allow cross-origin requests in local development. You can restrict this via
# the CORS_ORIGIN environment variable if desired.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("CORS_ORIGIN") or "*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Note: No allowlist is required for Replicate since we do not proxy source downloads

def normalize(params: dict) -> dict:
    """Clamp and sanitize generation parameters."""
    if params.get('text') is not None:
        return {
            "text": params.get("text"),
            "size": "2048x1152",  # fixed aspect ratio for predictable cost
        }
    return {
        "season": params.get("season", "summer"),
        "time": params.get("time", "noon"),
        "weather": params.get("weather", "clear"),
        "interventions": (params.get("interventions") or [])[:4],
        "size": "2048x1152",  # fixed aspect ratio for predictable cost
    }

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

# Back-compat endpoint for common health check typo
@app.get("/heathz")
async def heathz():
    return {"status": "ok", "hint": "use /healthz"}

@app.post("/")
async def generate(req: Request) -> Response:
    if isinstance(req, dict):
        body = req
    else:
        body = await req.json()
    provider = (body.get("provider") or "replicate").lower()
    # Only base64 input is supported; URLs are intentionally not handled.

    params = normalize(body.get("params", {}))

    # Replicate provider: run external pipeline and return the resulting image
    if provider == "replicate":
        if ReplicateClient is None:
            raise HTTPException(status_code=500, detail="replicate client not available; ensure dependency installed")

        token = os.environ.get("REPLICATE_API_TOKEN")
        if not token:
            raise HTTPException(status_code=500, detail="missing REPLICATE_API_TOKEN env var")

        # Build prompt
        prompt_text: str = "Transform this panoramic image into a photorealistic scene. Maintain the original perspective, geometry and layout. Ensure consistent lighting and seamless transitions. Here is the regeneration prompt:"  + str(params.get('text')) 
        # Compose image input for replicate by passing an in-memory file object.
        # Accept only: source_image_b64 (data URL or raw base64)

        # Initialize client early so helpers can use it
        replicate = ReplicateClient(
            api_token=token,
            headers={"User-Agent": body.get("user_agent") or "streetview-archive/1.0"},
        )

        async def prepare_image_file() -> io.BytesIO:
            b64 = body.get("source_image_b64")
            if isinstance(b64, str) and b64:
                b64_str = b64
                if b64_str.startswith("data:"):
                    try:
                        _, encoded = b64_str.split(",", 1)
                        b64_str = encoded
                    except Exception:
                        raise HTTPException(status_code=400, detail="invalid data URL in source_image_b64")
                try:
                    data = base64.b64decode(b64_str)
                except Exception:
                    raise HTTPException(status_code=400, detail="invalid base64 in source_image_b64")
                bio = io.BytesIO(data)
                # Hint a filename to help content-type detection on some backends
                try:
                    bio.name = "image.png"  # type: ignore[attr-defined]
                except Exception:
                    pass
                bio.seek(0)
                return bio

            raise HTTPException(status_code=400, detail="provide source_image_b64 as a data URL or raw base64 string")

        image_file = await prepare_image_file()

        # Allow custom models via request; otherwise use sensible defaults from example
        base_model = body.get("replicate_model") or "google/nano-banana"
        upscaler_model = body.get("replicate_upscaler") or "recraft-ai/recraft-crisp-upscale"

        # Helper to robustly extract URL from various return shapes
        def extract_url(value: Any) -> str | None:
            if value is None:
                return None
            if isinstance(value, str):
                return value
            if isinstance(value, dict):
                # common fields
                for k in ("url", "urls", "image", "output"):
                    vx = value.get(k)
                    if isinstance(vx, str):
                        return vx
                    if isinstance(vx, dict) and "url" in vx:
                        u = vx.get("url")
                        if isinstance(u, str):
                            return u
            if isinstance(value, (list, tuple)) and value:
                # often first element is the asset or has url
                u = extract_url(value[0])
                if u:
                    return u
            # object with attribute url
            u = getattr(value, "url", None)
            if isinstance(u, str):
                return u
            try:
                # sometimes callable url()
                u2 = value.url()  # type: ignore[attr-defined]
                if isinstance(u2, str):
                    return u2
            except Exception:
                pass
            return None

        # Step 1: base generation
        base_input = {
            "prompt": prompt_text,
            # Model expects an array for image_input; wrap single file in a list
            "image_input": [image_file],
        }
        async def run_with_retries(model: str, input_payload: dict[str, Any], what: str):
            delays = [0.25, 0.6, 1.2, 2.0]
            last_err: Exception | None = None
            for i, delay in enumerate(delays):
                try:
                    return replicate.run(model, input=input_payload)
                except Exception as err:  # noqa: BLE001
                    last_err = err
                    # Retry on transient Director/server errors
                    msg = str(err).lower()
                    if any(k in msg for k in ("director", "e6716", "timeout", "temporar", "5xx", "server error")) and i < len(delays) - 1:
                        await asyncio.sleep(delay)
                        continue
                    break
            raise HTTPException(status_code=502, detail=f"replicate {what} failed: {last_err}")

        base_output = await run_with_retries(base_model, base_input, "base model")

        base_url = extract_url(base_output)
        if not base_url:
            raise HTTPException(status_code=502, detail="replicate base model returned no URL")

        # Step 2: upscale/cleanup
        up_input = {"image": base_url}
        up_output = await run_with_retries(upscaler_model, up_input, "upscaler")

        final_url = extract_url(up_output) or base_url

        # Fetch the final image
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.get(final_url)
                if resp.status_code != 200:
                    raise HTTPException(status_code=502, detail=f"failed to download replicate image: {resp.status_code}")
                return Response(content=resp.content, media_type="image/png")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"replicate image fetch failed: {e}")
    # No other providers are supported
    raise HTTPException(status_code=400, detail="unsupported provider")
    

if __name__ == "__main__":
    example_request = {
        "provider": "replicate",
        "params": {
            "text": "A photorealistic scene of a city street"
        },
        "source_url": "https://replicate.delivery/pbxt/MKdkS3Po0PXytPbTXh4bOlBX1BZRuXH4o34yXVEakeBlpiTW/blonde_mj.png"
    }
    print(example_request)
    result = asyncio.run(generate(example_request))
    print(result)

# Secondary route for Render or other platforms that mount at the service root
@app.post("/api/generate")
async def generate_alias(req: Request) -> Response:
    return await generate(req)