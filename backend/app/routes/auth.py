"""
Onyx Streaming - Auth Routes
User registration, login, and token management
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from app.database import get_db
from app.services.auth_service import AuthService

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
security = HTTPBearer(auto_error=False)


# Request/Response Models
class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: int
    username: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    is_admin: bool
    
    class Config:
        from_attributes = True


class ProfileResponse(BaseModel):
    id: int
    name: str
    avatar_url: Optional[str] = None
    theme: str = "dark"
    
    class Config:
        from_attributes = True


from app.models.user import User, Profile


# Dependency: Get current user from JWT
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """Validate JWT and return current user"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    auth_service = AuthService(db)
    payload = auth_service.decode_token(credentials.credentials)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = await auth_service.get_user_by_id(int(payload["sub"]))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    
    return user


# Dependency: Get current profile from X-Profile-ID header
from fastapi import Header

async def get_current_profile(
    x_profile_id: Optional[int] = Header(None, alias="X-Profile-ID"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get active profile and verify ownership"""
    if not x_profile_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="X-Profile-ID header required"
        )
    
    auth_service = AuthService(db)
    profile = await auth_service.get_profile_by_id(x_profile_id)
    
    if not profile or profile.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid profile or access denied"
        )
    
    return profile


# Optional auth - doesn't fail if no token
async def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """Get user if authenticated, None otherwise"""
    if not credentials:
        return None
    
    try:
        auth_service = AuthService(db)
        payload = auth_service.decode_token(credentials.credentials)
        if payload:
            return await auth_service.get_user_by_id(int(payload["sub"]))
    except:
        pass
    return None


# Routes
@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user account"""
    auth_service = AuthService(db)
    
    # Check if user exists
    existing_email = await auth_service.get_user_by_email(request.email)
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    existing_username = await auth_service.get_user_by_username(request.username)
    if existing_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )
    
    # Create user
    user = await auth_service.create_user(
        username=request.username,
        email=request.email,
        password=request.password,
        is_admin=False
    )
    
    # Create default profile
    await auth_service.create_profile(user.id, user.username)
    
    # Generate tokens
    access_token = auth_service.create_access_token(user.id)
    refresh_token = auth_service.create_refresh_token(user.id)
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user.id,
        username=user.username
    )


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login with email and password"""
    auth_service = AuthService(db)
    
    user = await auth_service.authenticate(request.email, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    access_token = auth_service.create_access_token(user.id)
    refresh_token = auth_service.create_refresh_token(user.id)
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user.id,
        username=user.username
    )


@router.get("/me", response_model=UserResponse)
async def get_me(user = Depends(get_current_user)):
    """Get current authenticated user"""
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        is_admin=user.is_admin
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """Refresh access token using refresh token"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token required"
        )
    
    auth_service = AuthService(db)
    payload = auth_service.decode_token(credentials.credentials)
    
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    user = await auth_service.get_user_by_id(int(payload["sub"]))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    access_token = auth_service.create_access_token(user.id)
    refresh_token = auth_service.create_refresh_token(user.id)
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user.id,
        username=user.username
    )
