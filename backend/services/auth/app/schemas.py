from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    first_name: str = Field(min_length=1, max_length=128)
    last_name: str = Field(min_length=1, max_length=128)
    phone: str | None = None
    recaptcha_token: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    recaptcha_token: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    mfa_required: bool = False
    mfa_session_id: str | None = None


class RefreshRequest(BaseModel):
    refresh_token: str


class MFAVerifyRequest(BaseModel):
    mfa_session_id: str
    code: str


class UserResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    digital_identity_id: str | None
    status: str
    mfa_enabled: bool
    email_verified: bool
    phone_verified: bool

    model_config = {"from_attributes": True}


class AccountActionRequest(BaseModel):
    reason: str | None = None
