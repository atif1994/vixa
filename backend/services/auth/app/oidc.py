from pydantic import BaseModel, EmailStr


class OAuthTokenRequest(BaseModel):
    grant_type: str
    username: EmailStr | None = None
    password: str | None = None
    refresh_token: str | None = None
    client_id: str | None = None
    scope: str | None = "openid profile email"


class OAuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    refresh_token: str | None = None
    id_token: str | None = None
    scope: str | None = None
