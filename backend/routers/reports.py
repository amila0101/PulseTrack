import logging
from fastapi import APIRouter, Depends, HTTPException, status, Response
from uuid import UUID
from datetime import date
from supabase import Client
from dependencies import get_current_user, check_user_role, get_authed_supabase
from models import ReportResponse, ReportWithMetaResponse, ReportCreate, ReportUpdate, AppRole

router = APIRouter()
logger = logging.getLogger("pulsetrack.reports")

def prepare_data(data: dict) -> dict:
    """Helper to convert UUID and date objects to strings for JSON/Supabase serialization."""
    serialized = {}
    for key, value in data.items():
        if isinstance(value, UUID):
            serialized[key] = str(value)
        elif isinstance(value, date):
            serialized[key] = value.isoformat()
        else:
            serialized[key] = value
    return serialized


@router.get("", response_model=list[ReportWithMetaResponse])
async def list_reports(
    all_reports: bool = False,
    current_user: dict = Depends(get_current_user),
    role: AppRole = Depends(check_user_role),
    supabase: Client = Depends(get_authed_supabase),
):
    """
    Return a list of reports.
    - Members see only their own reports.
    - Managers pass ?all_reports=true to see the entire team's reports.
    Batch-resolves user profiles in a single query to prevent N+1 queries.
    """
    query = supabase.table("reports").select("*, project:projects(id,name)")

    if all_reports:
        if role != AppRole.MANAGER:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Only managers can view all team reports.",
            )
        response = query.order("week_start_date", desc=True).execute()
    else:
        response = (
            query.eq("user_id", current_user["id"])
            .order("week_start_date", desc=True)
            .execute()
        )

    reports_data: list[dict] = response.data or []

    # Batch-resolve profiles — one query for all user IDs in the result set
    user_ids = list({r["user_id"] for r in reports_data})
    profiles_map: dict[str, dict] = {}
    if user_ids:
        profiles_response = (
            supabase.table("profiles")
            .select("id, full_name, email")
            .in_("id", user_ids)
            .execute()
        )
        for p in profiles_response.data or []:
            profiles_map[p["id"]] = p

    return [
        {
            "id": r["id"],
            "user_id": r["user_id"],
            "project_id": r["project_id"],
            "week_start_date": r["week_start_date"],
            "tasks_completed": r["tasks_completed"],
            "tasks_planned": r["tasks_planned"],
            "blockers": r["blockers"],
            "hours_worked": r["hours_worked"],
            "status": r["status"],
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
            "project": r.get("project"),
            "profile": profiles_map.get(r["user_id"]),
        }
        for r in reports_data
    ]


@router.post("", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    report_input: ReportCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_authed_supabase),
):
    """
    Create a new weekly report.
    The user_id is automatically populated from the verified JWT — never trusted from the client.
    """
    data = report_input.model_dump()
    data["user_id"] = current_user["id"]
    data = prepare_data(data)

    response = supabase.table("reports").insert(data).execute()
    if not response.data:
        logger.error("Failed to insert report for user %s", current_user["id"])
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create weekly report. Check that all required fields are valid.",
        )

    logger.info("Report created (id=%s) for user %s", response.data[0]["id"], current_user["id"])
    return response.data[0]


@router.put("/{report_id}", response_model=ReportResponse)
async def update_report(
    report_id: UUID,
    report_input: ReportUpdate,
    current_user: dict = Depends(get_current_user),
    role: AppRole = Depends(check_user_role),
    supabase: Client = Depends(get_authed_supabase),
):
    """
    Update an existing report.
    - Members can only update their own reports.
    - Managers can update any report.
    """
    existing = (
        supabase.table("reports")
        .select("user_id")
        .eq("id", str(report_id))
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report {report_id} not found.",
        )

    owner_id = existing.data[0]["user_id"]
    if owner_id != current_user["id"] and role != AppRole.MANAGER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are not authorised to update this report.",
        )

    data = report_input.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided for update.",
        )
    
    data = prepare_data(data)

    response = supabase.table("reports").update(data).eq("id", str(report_id)).execute()
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Update failed. Please try again.",
        )

    logger.info("Report %s updated by user %s", report_id, current_user["id"])
    return response.data[0]


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(
    report_id: UUID,
    current_user: dict = Depends(get_current_user),
    role: AppRole = Depends(check_user_role),
    supabase: Client = Depends(get_authed_supabase),
):
    """
    Delete a report. Returns 204 No Content.
    - Members can only delete their own reports.
    - Managers can delete any report.
    """
    existing = (
        supabase.table("reports")
        .select("user_id")
        .eq("id", str(report_id))
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report {report_id} not found.",
        )

    owner_id = existing.data[0]["user_id"]
    if owner_id != current_user["id"] and role != AppRole.MANAGER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are not authorised to delete this report.",
        )

    supabase.table("reports").delete().eq("id", str(report_id)).execute()
    logger.info("Report %s deleted by user %s", report_id, current_user["id"])
    return Response(status_code=status.HTTP_204_NO_CONTENT)