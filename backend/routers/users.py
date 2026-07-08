import logging
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client
from dependencies import get_current_user, check_user_role, require_manager, get_authed_supabase
from models import ProfileResponse, ProfileMinimal, AppRole

router = APIRouter()
logger = logging.getLogger("pulsetrack.users")


@router.get("/me", response_model=ProfileResponse)
async def get_my_profile(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_authed_supabase),
):
    """Fetch the currently logged-in user's profile."""
    user_id = current_user["id"]
    response = supabase.table("profiles").select("*").eq("id", user_id).execute()
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found. Ensure the profiles table is populated on sign-up.",
        )
    return response.data[0]


@router.get("/me/role")
async def get_my_role(
    role: AppRole = Depends(check_user_role),
):
    """Fetch the currently logged-in user's system role (member | manager)."""
    return {"role": role}


@router.get("/team", response_model=list[ProfileMinimal])
async def list_team_profiles(
    _role: AppRole = Depends(require_manager),
    supabase: Client = Depends(get_authed_supabase),
):
    """
    [Manager only] Return all team member profiles for the Team Reports filter dropdown.
    """
    response = (
        supabase.table("profiles")
        .select("id, full_name, email")
        .order("full_name", desc=False)
        .execute()
    )
    profiles = response.data or []
    logger.info("Fetched %d team profiles.", len(profiles))
    return profiles
