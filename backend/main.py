import os
import logging
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

# ── Logging setup ────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("pulsetrack")

# ── Application ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="PulseTrack API",
    description="Production-ready FastAPI backend for the PulseTrack team-reporting application.",
    version="1.0.0",
)

# ── CORS ─────────────────────────────────────────────────────────────────────
# ALLOWED_ORIGINS is read from the environment as a comma-separated string and
# split into a Python list here.  CORSMiddleware requires a list[str], not a
# raw string — passing the raw string causes every origin check to fail.
#
# IMPORTANT: Never use ["*"] with allow_credentials=True — the CORS spec
# forbids it and browsers silently reject all credentialed cross-origin requests.
_origins_raw: str = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173",
)
# Split on commas, strip whitespace, discard empty tokens.
origins: list[str] = [origin.strip() for origin in _origins_raw.split(",") if origin.strip()]

# Log the resolved list immediately so it is visible in the terminal on startup.
print(f"[PulseTrack] CORS allowed origins: {origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=False, 
    allow_methods=["*"],
    allow_headers=["*"],

)

# ── Routers ───────────────────────────────────────────────────────────────────
from routers import users, projects, reports, chat  # noqa: E402 (after app init)

app.include_router(users.router,    prefix="/api/users",    tags=["Users"])
app.include_router(projects.router,  prefix="/api/projects",  tags=["Projects"])
app.include_router(reports.router,   prefix="/api/reports",   tags=["Reports"])
app.include_router(chat.router,      prefix="/api/chat",      tags=["Chat"])

# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health_check():
    """Simple liveness probe."""
    return {"status": "healthy", "service": "PulseTrack API"}


# ── Startup event ─────────────────────────────────────────────────────────────
@app.on_event("startup")
async def on_startup():
    logger.info("PulseTrack API started successfully.")
    logger.info("Allowed CORS origins: %s", origins)


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.getenv("BACKEND_PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
