## Monorepo layout

```
.
├─ apps/
│  ├─ web/   # Next.js frontend
│  └─ api/   # FastAPI backend (uv-managed)
├─ infra/    # Dockerfiles and compose
├─ .env.example
```

## Getting started (Docker)

1. Copy envs and set your token:
   - `cp .env.example .env`
   - Edit `.env` and set `REPLICATE_API_TOKEN`
2. Build and run:
   - `docker compose -f infra/docker-compose.yml up --build`
3. Open:
   - Web: http://localhost:3000
   - API: http://localhost:8000/healthz

## Local dev (without Docker)

Frontend (Next.js):
- `cd apps/web`
- `npm install`
- `npm run dev` (uses `NEXT_PUBLIC_API_BASE` if set; otherwise `/api/generate`)

Backend (FastAPI with uv):
- `cd apps/api`
- `uv sync`
- `uv run uvicorn apps.api.generate:app --host 0.0.0.0 --port 8000`

## Notes
- The API exposes `POST /api/generate` only.
- Python deps are managed via `pyproject.toml` and `uv.lock` with uv.
- In Docker Compose, the frontend embeds `NEXT_PUBLIC_API_BASE=http://localhost:8000/api/generate` so the browser can reach the API.

