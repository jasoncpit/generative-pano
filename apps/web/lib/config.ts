// Configuration helpers for validating source panorama URLs and
// restricting external network requests on the backend.

// Define a comma-separated list of allowed host names in your
// environment variable ALLOWLIST_HOSTS. This prevents the API
// from fetching arbitrary URLs. If none is provided it defaults to
// localhost.

export const ALLOWLISTED_IMAGE_HOSTS: string[] = (process.env.ALLOWLIST_HOSTS || 'localhost:8000').split(
  ','
);

export function isAllowedSource(url: string): boolean {
  try {
    const u = new URL(url);
    return ALLOWLISTED_IMAGE_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

// ---- Image generation models (frontend) ----
// These model identifiers are passed directly to the backend as `replicate_model`.
// Keep labels human-friendly; `model` must be the exact slug accepted by Replicate.
export type BaseModelOption = {
  id: string
  label: string
  model: string
  default?: boolean
}

export const AVAILABLE_BASE_MODELS: BaseModelOption[] = [
  {
    id: 'google-nano-banana',
    label: 'Google Nano Banana',
    model: 'google/nano-banana',
    default: true,
  },
  {
    id: 'qwen/qwen-image-edit-plus',
    label: 'Qwen Image Edit Plus',
    model: 'qwen/qwen-image-edit-plus',
  },
  {
    id: 'google-image-upscaler',
    label: 'Google Image Upscaler',
    model: 'google/image-upscaler',
  },
]

export const DEFAULT_BASE_MODEL: BaseModelOption =
  AVAILABLE_BASE_MODELS.find((m) => m.default) ?? AVAILABLE_BASE_MODELS[0]