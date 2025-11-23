import base64
import io
from typing import Any, Tuple

from fastapi import HTTPException, Response
from .. import settings as settings_mod

try:
    from replicate.client import Client as ReplicateClient  # type: ignore
except Exception:
    ReplicateClient = None  # type: ignore


def build_prompt(text: str) -> str:
    return (
        "Transform this panoramic image into a photorealistic scene. "
        "Maintain the original perspective, geometry and layout. "
        "Ensure consistent lighting and seamless transitions. "
        "Here is the regeneration prompt: " + (text or "")
    )


def init_replicate_client(user_agent: str | None) -> ReplicateClient:
    if ReplicateClient is None:
        raise HTTPException(status_code=500, detail="replicate client not available; ensure dependency installed")
    token = settings_mod.get_settings().replicate_api_token
    if not token:
        raise HTTPException(status_code=500, detail="missing REPLICATE_API_TOKEN env var")
    headers = {"User-Agent": user_agent or "streetview-archive/1.0"}
    try:
        return ReplicateClient(api_token=token, headers=headers)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"failed to initialize replicate client: {e}")


def parse_b64_image(b64: str) -> io.BytesIO:
    if not isinstance(b64, str) or not b64:
        raise HTTPException(status_code=400, detail="source_image_b64 is required")
    limit = settings_mod.get_settings().max_b64_bytes
    b64_str = b64
    if b64_str.startswith("data:"):
        try:
            _, encoded = b64_str.split(",", 1)
            b64_str = encoded
        except Exception:
            raise HTTPException(status_code=400, detail="invalid data URL in source_image_b64")
    if len(b64_str) > limit:
        raise HTTPException(status_code=413, detail="source_image_b64 too large")
    try:
        data = base64.b64decode(b64_str)
    except Exception:
        raise HTTPException(status_code=400, detail="invalid base64 in source_image_b64")
    bio = io.BytesIO(data)
    try:
        bio.name = "image.png"  # type: ignore[attr-defined]
    except Exception:
        pass
    bio.seek(0)
    return bio


def extract_url(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        for k in ("url", "urls", "image", "output"):
            vx = value.get(k)
            if isinstance(vx, str):
                return vx
            if isinstance(vx, dict) and "url" in vx:
                u = vx.get("url")
                if isinstance(u, str):
                    return u
    if isinstance(value, (list, tuple)) and value:
        u = extract_url(value[0])
        if u:
            return u
    u = getattr(value, "url", None)
    if isinstance(u, str):
        return u
    try:
        u2 = value.url()  # type: ignore[attr-defined]
        if isinstance(u2, str):
            return u2
    except Exception:
        pass
    return None


def run_replicate_pipeline(client: ReplicateClient, prompt_text: str, image_file: io.BytesIO, replicate_model: str, upscale_model: str) -> str:
    # Step 1: base generation - some models expect `image` vs `image_input`
    if replicate_model == "qwen/qwen-image-edit-plus":
        input_payload = {
            "prompt": prompt_text,
            "image": [image_file],
        }
    else:
        input_payload = {
            "prompt": prompt_text,
            "image_input": [image_file],
        }
    base_output = client.run(replicate_model, input=input_payload)
    base_url = extract_url(base_output)
    if not base_url:
        raise HTTPException(status_code=502, detail="replicate base model returned no URL")

    # Step 2: upscale/cleanup
    up_output = client.run(upscale_model, input={"image": base_url})
    final_url = extract_url(up_output) or base_url
    return final_url


async def fetch_final_bytes(url: str) -> Tuple[bytes, str]:
    import httpx

    try:
        async with httpx.AsyncClient(timeout=60.0) as client_http:
            resp = await client_http.get(url)
            if resp.status_code != 200:
                raise HTTPException(status_code=502, detail=f"failed to download replicate image: {resp.status_code}")
            # Basic content type inference
            media_type = resp.headers.get("content-type") or "image/png"
            return resp.content, media_type
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"replicate image fetch failed: {e}")


