import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import os
from dotenv import load_dotenv
from supabase import Client, create_client
from database import get_supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY
from models import AppRole

load_dotenv()

logger = logging.getLogger("pulsetrack.dependencies")

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

security = HTTPBearer()


# ── User identity ─────────────────────────────────────────────────────────────

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    supabase: Client = Depends(get_supabase),
) -> dict:
    """
    Validates the Supabase JWT from the Authorization header.
    Returns a dict with 'id', 'email', and 'token' on success.
    """
    token = credentials.credentials

    # Offline verification (fast, production-recommended)
    if SUPABASE_JWT_SECRET:
        try:
            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
            user_id = payload.get("sub")
            email = payload.get("email")
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token payload: missing 'sub' claim.",
                )
            return {"id": user_id, "email": email, "token": token, "payload": payload}
        except JWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Token verification failed: {exc}",
            )

    # Fallback: validate via Supabase API (no local secret needed in dev)
    try:
        response = supabase.auth.get_user(token)
        if not response or not response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired access token.",
            )
        user = response.user
        return {
            "id": user.id,
            "email": user.email,
            "token": token,
            "payload": user.user_metadata,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {exc}",
        )


# ── Per-request authenticated Supabase client ─────────────────────────────────

def get_authed_supabase(
    current_user: dict = Depends(get_current_user),
) -> Client:
    """
    Returns a Supabase client authenticated as the current user.

    WHY THIS IS NECESSARY
    ─────────────────────
    The shared anon client (get_supabase) queries Supabase as the PostgreSQL
    `anon` role.  Supabase RLS policies written as `TO authenticated` never
    match the anon role, so every query returns [] even with valid data.

    By forwarding the user's JWT (Bearer token) to the PostgREST layer we
    tell Supabase "this request comes from an authenticated user", so:
      • auth.uid() resolves to the real user ID
      • `TO authenticated` policies apply
      • RLS filters work as intended

    A new client is created per request to avoid mutating shared state
    (thread-safety in multi-worker deployments).
    """
    token = current_user.get("token")
    client: Client = create_client(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
    if token:
        # Forward the user JWT so PostgREST runs as `authenticated` role
        client.postgrest.auth(token)
    return client


# ── Role resolution ───────────────────────────────────────────────────────────

async def check_user_role(
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_authed_supabase),
) -> AppRole:
    """
    Fetches the user's role from the `user_roles` table.
    Returns AppRole.MEMBER as a safe default if no role row exists.
    """
    user_id = user["id"]
    try:
        response = (
            supabase.table("user_roles")
            .select("role")
            .eq("user_id", user_id)
            .execute()
        )
        if response.data:
            return AppRole(response.data[0]["role"])
        logger.warning("No role found for user %s — defaulting to MEMBER.", user_id)
        return AppRole.MEMBER
    except Exception as exc:
        logger.error("Role lookup failed for user %s: %s", user_id, exc)
        return AppRole.MEMBER


# ── RBAC enforcement ──────────────────────────────────────────────────────────

class RoleChecker:
    """FastAPI dependency that enforces a minimum required role."""

    def __init__(self, allowed_roles: list[AppRole]) -> None:
        self.allowed_roles = allowed_roles

    def __call__(self, role: AppRole = Depends(check_user_role)) -> AppRole:
        if role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Insufficient permissions.",
            )
        return role


require_manager = RoleChecker([AppRole.MANAGER])
require_member = RoleChecker([AppRole.MEMBER, AppRole.MANAGER])
