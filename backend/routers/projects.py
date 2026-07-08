import logging
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client
from dependencies import get_current_user, check_user_role, require_manager, get_authed_supabase
from models import ProjectResponse, ProjectCreate, ProjectUpdate
from uuid import UUID

router = APIRouter()
logger = logging.getLogger("pulsetrack.projects")


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_authed_supabase),
):
    """
    List all projects. Any authenticated user can read this list
    (needed for the 'Select project' dropdown on the report form).
    """
    response = supabase.table("projects").select("*").order("name").execute()
    projects = response.data or []
    logger.info("Listed %d projects for user %s", len(projects), current_user["id"])
    return projects


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_input: ProjectCreate,
    current_user: dict = Depends(get_current_user),
    _role=Depends(require_manager),
    supabase: Client = Depends(get_authed_supabase),
):
    """Create a new project. Restricted to managers."""
    data = project_input.model_dump()
    response = supabase.table("projects").insert(data).execute()
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create project.",
        )
    logger.info("Project '%s' created by user %s", data["name"], current_user["id"])
    return response.data[0]


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    project_input: ProjectUpdate,
    current_user: dict = Depends(get_current_user),
    _role=Depends(require_manager),
    supabase: Client = Depends(get_authed_supabase),
):
    """Update an existing project. Restricted to managers."""
    data = project_input.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided for update.",
        )
    response = supabase.table("projects").update(data).eq("id", str(project_id)).execute()
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or update failed.",
        )
    logger.info("Project %s updated by user %s", project_id, current_user["id"])
    return response.data[0]


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    current_user: dict = Depends(get_current_user),
    _role=Depends(require_manager),
    supabase: Client = Depends(get_authed_supabase),
):
    """
    Delete a project. Restricted to managers. Returns 204 No Content.
    Returns 409 Conflict if reports are still linked to this project.
    """
    from fastapi import Response
    try:
        supabase.table("projects").delete().eq("id", str(project_id)).execute()
        logger.info("Project %s deleted by user %s", project_id, current_user["id"])
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except Exception as exc:
        error_str = str(exc).lower()
        # PostgREST raises an error when a FK constraint prevents deletion
        if "foreign key" in error_str or "violates" in error_str or "23503" in error_str:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Cannot delete this project because reports are still linked to it. "
                    "Re-assign or delete those reports first."
                ),
            )
        logger.error("Unexpected error deleting project %s: %s", project_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete project. Please try again.",
        )
