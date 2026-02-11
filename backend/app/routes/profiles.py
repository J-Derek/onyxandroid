"""
Onyx Streaming - Profile Routes
Profile management for multi-user support
"""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List

from app.database import get_db
from app.services.auth_service import AuthService
from app.routes.auth import get_current_user

router = APIRouter(prefix="/api/profiles", tags=["Profiles"])


# Request/Response Models
class CreateProfileRequest(BaseModel):
    name: str
    avatar_url: Optional[str] = None


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    theme: Optional[str] = None
    eq_preset: Optional[str] = None
    crossfade_ms: Optional[int] = None


class SetPinRequest(BaseModel):
    pin: str


class VerifyPinRequest(BaseModel):
    pin: str


class ProfileResponse(BaseModel):
    id: int
    name: str
    avatar_url: Optional[str] = None
    theme: str = "dark"
    has_pin: bool = False
    
    class Config:
        from_attributes = True


# Routes
@router.get("", response_model=List[ProfileResponse])
async def list_profiles(
    user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all profiles for current user"""
    auth_service = AuthService(db)
    profiles = await auth_service.get_user_profiles(user.id)
    
    return [
        ProfileResponse(
            id=p.id,
            name=p.name,
            avatar_url=p.avatar_url,
            theme=p.theme,
            has_pin=bool(p.pin_hash)
        )
        for p in profiles
    ]


@router.post("", response_model=ProfileResponse, status_code=status.HTTP_201_CREATED)
async def create_profile(
    request: CreateProfileRequest,
    user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new profile"""
    auth_service = AuthService(db)
    
    # Limit profiles per user
    existing = await auth_service.get_user_profiles(user.id)
    if len(existing) >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 5 profiles per user"
        )
    
    profile = await auth_service.create_profile(
        user_id=user.id,
        name=request.name,
        avatar_url=request.avatar_url
    )
    
    return ProfileResponse(
        id=profile.id,
        name=profile.name,
        avatar_url=profile.avatar_url,
        theme=profile.theme,
        has_pin=False
    )


@router.get("/{profile_id}", response_model=ProfileResponse)
async def get_profile(
    profile_id: int,
    user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific profile"""
    auth_service = AuthService(db)
    profile = await auth_service.get_profile_by_id(profile_id)
    
    if not profile or profile.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    
    return ProfileResponse(
        id=profile.id,
        name=profile.name,
        avatar_url=profile.avatar_url,
        theme=profile.theme,
        has_pin=bool(profile.pin_hash)
    )


@router.put("/{profile_id}", response_model=ProfileResponse)
async def update_profile(
    profile_id: int,
    request: UpdateProfileRequest,
    user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update profile settings"""
    auth_service = AuthService(db)
    profile = await auth_service.get_profile_by_id(profile_id)
    
    if not profile or profile.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    
    update_data = request.model_dump(exclude_unset=True)
    profile = await auth_service.update_profile(profile_id, **update_data)
    
    return ProfileResponse(
        id=profile.id,
        name=profile.name,
        avatar_url=profile.avatar_url,
        theme=profile.theme,
        has_pin=bool(profile.pin_hash)
    )


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_profile(
    profile_id: int,
    user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a profile"""
    auth_service = AuthService(db)
    profile = await auth_service.get_profile_by_id(profile_id)
    
    if not profile or profile.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    
    # Ensure at least one profile remains
    profiles = await auth_service.get_user_profiles(user.id)
    if len(profiles) <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete last profile"
        )
    
    await auth_service.delete_profile(profile_id)


@router.post("/{profile_id}/pin")
async def set_profile_pin(
    profile_id: int,
    request: SetPinRequest,
    user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Set or update profile PIN"""
    auth_service = AuthService(db)
    profile = await auth_service.get_profile_by_id(profile_id)
    
    if not profile or profile.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    
    await auth_service.set_profile_pin(profile_id, request.pin)
    return {"message": "PIN set successfully"}


@router.post("/{profile_id}/verify-pin")
async def verify_profile_pin(
    profile_id: int,
    request: VerifyPinRequest,
    user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Verify profile PIN"""
    auth_service = AuthService(db)
    profile = await auth_service.get_profile_by_id(profile_id)
    
    if not profile or profile.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    
    valid = await auth_service.verify_profile_pin(profile_id, request.pin)
    if not valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid PIN"
        )
    
    return {"valid": True}


@router.delete("/{profile_id}/pin")
async def remove_profile_pin(
    profile_id: int,
    user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Remove profile PIN"""
    auth_service = AuthService(db)
    profile = await auth_service.get_profile_by_id(profile_id)
    
    if not profile or profile.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profile not found"
        )
    
    profile.pin_hash = None
    await db.commit()
    return {"message": "PIN removed successfully"}
