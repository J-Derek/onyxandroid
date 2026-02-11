"""
Onyx Streaming - Auth Service
JWT authentication and password hashing
"""
import jwt
import bcrypt
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.user import User, Profile
from app.config import get_settings


class AuthService:
    """Authentication service for user management"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.settings = get_settings()
    
    # Password hashing
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash password with bcrypt"""
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode(), salt).decode()
    
    @staticmethod
    def verify_password(password: str, hashed: str) -> bool:
        """Verify password against hash"""
        return bcrypt.checkpw(password.encode(), hashed.encode())
    
    # JWT tokens
    def create_access_token(self, user_id: int, profile_id: Optional[int] = None) -> str:
        """Create JWT access token"""
        expire = datetime.utcnow() + timedelta(hours=24)
        payload = {
            "sub": str(user_id),
            "profile_id": profile_id,
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "access"
        }
        return jwt.encode(payload, self.settings.jwt_secret, algorithm="HS256")
    
    def create_refresh_token(self, user_id: int) -> str:
        """Create JWT refresh token"""
        expire = datetime.utcnow() + timedelta(days=30)
        payload = {
            "sub": str(user_id),
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "refresh"
        }
        return jwt.encode(payload, self.settings.jwt_secret, algorithm="HS256")
    
    def decode_token(self, token: str) -> Optional[dict]:
        """Decode and validate JWT token"""
        try:
            payload = jwt.decode(token, self.settings.jwt_secret, algorithms=["HS256"])
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
    
    # User operations
    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Find user by email"""
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()
    
    async def get_user_by_username(self, username: str) -> Optional[User]:
        """Find user by username"""
        result = await self.db.execute(
            select(User).where(User.username == username)
        )
        return result.scalar_one_or_none()
    
    async def get_user_by_id(self, user_id: int) -> Optional[User]:
        """Find user by ID"""
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()
    
    async def create_user(self, username: str, email: str, password: str, is_admin: bool = False) -> User:
        """Create new user account"""
        user = User(
            username=username,
            email=email,
            password_hash=self.hash_password(password),
            is_admin=is_admin
        )
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        return user
    
    async def authenticate(self, email: str, password: str) -> Optional[User]:
        """Authenticate user with email and password"""
        user = await self.get_user_by_email(email)
        if user and self.verify_password(password, user.password_hash):
            return user
        return None
    
    # Profile operations
    async def get_user_profiles(self, user_id: int) -> list[Profile]:
        """Get all profiles for a user"""
        result = await self.db.execute(
            select(Profile).where(Profile.user_id == user_id)
        )
        return list(result.scalars().all())
    
    async def get_profile_by_id(self, profile_id: int) -> Optional[Profile]:
        """Get profile by ID"""
        result = await self.db.execute(
            select(Profile).where(Profile.id == profile_id)
        )
        return result.scalar_one_or_none()
    
    async def create_profile(self, user_id: int, name: str, avatar_url: Optional[str] = None) -> Profile:
        """Create new profile for user"""
        profile = Profile(
            user_id=user_id,
            name=name,
            avatar_url=avatar_url
        )
        self.db.add(profile)
        await self.db.commit()
        await self.db.refresh(profile)
        return profile
    
    async def update_profile(self, profile_id: int, **kwargs) -> Optional[Profile]:
        """Update profile fields"""
        profile = await self.get_profile_by_id(profile_id)
        if not profile:
            return None
        
        for key, value in kwargs.items():
            if hasattr(profile, key):
                setattr(profile, key, value)
        
        await self.db.commit()
        await self.db.refresh(profile)
        return profile
    
    async def delete_profile(self, profile_id: int) -> bool:
        """Delete profile"""
        profile = await self.get_profile_by_id(profile_id)
        if not profile:
            return False
        
        await self.db.delete(profile)
        await self.db.commit()
        return True
    
    async def verify_profile_pin(self, profile_id: int, pin: str) -> bool:
        """Verify profile PIN"""
        profile = await self.get_profile_by_id(profile_id)
        if not profile or not profile.pin_hash:
            return True  # No PIN set
        return self.verify_password(pin, profile.pin_hash)
    
    async def set_profile_pin(self, profile_id: int, pin: str) -> bool:
        """Set or update profile PIN"""
        profile = await self.get_profile_by_id(profile_id)
        if not profile:
            return False
        
        profile.pin_hash = self.hash_password(pin)
        await self.db.commit()
        return True
