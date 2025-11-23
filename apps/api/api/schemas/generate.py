from pydantic import BaseModel, Field, ConfigDict


class GenerateParams(BaseModel):
    text: str = Field(default="", max_length=500)
    replicate_model: str = Field(default="google/nano-banana")
    upscale_model: str = Field(default="recraft-ai/recraft-crisp-upscale")


class GenerateRequest(BaseModel):
    # Ignore unknown fields like "provider" for forwards/backwards compatibility
    model_config = ConfigDict(extra="ignore")
    params: GenerateParams
    source_image_b64: str
    user_agent: str | None = None


