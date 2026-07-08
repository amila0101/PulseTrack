import os
import logging
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

logger = logging.getLogger("pulsetrack.database")

# ── Environment variable resolution ──────────────────────────────────────────
# The canonical key name for the Supabase anon/publishable key is
# SUPABASE_PUBLISHABLE_KEY. SUPABASE_KEY is kept as a legacy fallback only.
SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_PUBLISHABLE_KEY: str = (
    os.getenv("SUPABASE_PUBLISHABLE_KEY") or os.getenv("SUPABASE_KEY") or ""
)
# Service-role key (bypasses RLS — admin operations only)
SUPABASE_SERVICE_KEY: str = os.getenv("SUPABASE_SERVICE_KEY", "")

# ── Startup validation ────────────────────────────────────────────────────────
if not SUPABASE_URL:
    raise EnvironmentError(
        "SUPABASE_URL is not set. "
        "Add it to backend/.env — see backend/.env.example for the required format."
    )
if not SUPABASE_PUBLISHABLE_KEY:
    raise EnvironmentError(
        "SUPABASE_PUBLISHABLE_KEY is not set. "
        "Add it to backend/.env — see backend/.env.example for the required format."
    )

# ── Public client (anon key — respects RLS) ───────────────────────────────────
supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)

# ── Admin client (service-role key — bypasses RLS) ───────────────────────────
# Only initialised when SUPABASE_SERVICE_KEY is supplied.
supabase_service_client: Client | None = None
if SUPABASE_SERVICE_KEY:
    supabase_service_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    logger.info("Supabase admin client initialised (service-role key present).")
else:
    logger.warning(
        "SUPABASE_SERVICE_KEY is not set. "
        "Admin client is unavailable; endpoints requiring it will raise 503."
    )


def get_supabase() -> Client:
    """FastAPI dependency — returns the public (anon) Supabase client."""
    return supabase_client


def get_supabase_admin() -> Client:
    """
    FastAPI dependency — returns the admin Supabase client (bypasses RLS).
    Raises RuntimeError if SUPABASE_SERVICE_KEY is not configured.
    """
    if supabase_service_client is None:
        raise RuntimeError(
            "Admin operations require SUPABASE_SERVICE_KEY to be configured in backend/.env."
        )
    return supabase_service_client
