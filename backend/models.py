from datetime import datetime, date
from enum import Enum
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field, EmailStr

# --- Enums ---
class AppRole(str, Enum):
    MEMBER = "member"
    MANAGER = "manager"

class ReportStatus(str, Enum):
    SUBMITTED = "submitted"
    PENDING = "pending"

# --- Profiles ---
class ProfileBase(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = Field(None, max_length=255)

class ProfileCreate(ProfileBase):
    id: UUID  # Matches Supabase Auth user ID

class ProfileUpdate(ProfileBase):
    pass

class ProfileResponse(ProfileBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ProfileMinimal(BaseModel):
    id: UUID
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None

    class Config:
        from_attributes = True


# --- User Roles ---
class UserRoleBase(BaseModel):
    role: AppRole = AppRole.MEMBER

class UserRoleCreate(UserRoleBase):
    user_id: UUID

class UserRoleUpdate(UserRoleBase):
    pass

class UserRoleResponse(UserRoleBase):
    id: UUID
    user_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


# --- Projects ---
class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None

class ProjectCreate(ProjectBase):
    pass

class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None

class ProjectResponse(ProjectBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ProjectMinimal(BaseModel):
    id: UUID
    name: str

    class Config:
        from_attributes = True


# --- Reports ---
class ReportBase(BaseModel):
    project_id: Optional[UUID] = None
    week_start_date: date  # validated as YYYY-MM-DD
    tasks_completed: Optional[str] = None
    tasks_planned: Optional[str] = None
    blockers: Optional[str] = None
    hours_worked: Optional[float] = Field(None, ge=0, le=168)  # max hours in a week
    status: ReportStatus = ReportStatus.SUBMITTED

class ReportCreate(ReportBase):
    pass

class ReportUpdate(BaseModel):
    project_id: Optional[UUID] = None
    week_start_date: Optional[date] = None
    tasks_completed: Optional[str] = None
    tasks_planned: Optional[str] = None
    blockers: Optional[str] = None
    hours_worked: Optional[float] = Field(None, ge=0, le=168)
    status: Optional[ReportStatus] = None

class ReportResponse(ReportBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- Composite Response Models (With Meta) ---
class ReportWithMetaResponse(ReportResponse):
    project: Optional[ProjectMinimal] = None
    profile: Optional[ProfileMinimal] = None

    class Config:
        from_attributes = True
