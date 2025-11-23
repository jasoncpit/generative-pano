from fastapi import APIRouter, Response
from ..schemas.generate import GenerateRequest
from ..services.replicate import (
    build_prompt,
    init_replicate_client,
    parse_b64_image,
    run_replicate_pipeline,
    fetch_final_bytes,
)

router = APIRouter()


@router.post("/generate")
async def generate(body: GenerateRequest) -> Response:
    prompt = build_prompt(body.params.text)
    image_file = parse_b64_image(body.source_image_b64)
    client = init_replicate_client(body.user_agent)
    final_url = run_replicate_pipeline(client, prompt, image_file, body.params.replicate_model, body.params.upscale_model)
    content, media_type = await fetch_final_bytes(final_url)
    return Response(content=content, media_type=media_type)


