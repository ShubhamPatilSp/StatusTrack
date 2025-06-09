import json
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2AuthorizationCodeBearer, SecurityScopes
import httpx # For making HTTP requests to get JWKS
from jose import jwt, JWTError
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional

from app.config import settings

# --- Auth0 Configuration ---
AUTH0_DOMAIN = settings.AUTH0_DOMAIN
API_AUDIENCE = settings.AUTH0_API_AUDIENCE
ALGORITHMS = ["RS256"]

# --- Custom Exception for Auth Errors ---
class AuthError(HTTPException):
    def __init__(self, detail: str, status_code: int = status.HTTP_401_UNAUTHORIZED):
        super().__init__(status_code=status_code, detail=detail)

# --- Token Payload Model (Optional but good practice) ---
class TokenPayload(BaseModel):
    sub: str = Field(..., description="Subject (usually the user_id from Auth0)")
    iss: Optional[str] = None
    aud: Optional[List[str]] = None # Audience can be a list or string
    iat: Optional[int] = None
    exp: Optional[int] = None
    scope: Optional[str] = None
    permissions: Optional[List[str]] = Field(default_factory=list)
    # Add fields to capture user information, assuming they are in the token
    email: Optional[str] = None # Pydantic EmailStr can be used if validation is desired here
    name: Optional[str] = None
    picture: Optional[str] = None # Pydantic HttpUrl can be used if validation is desired here
    # You might also get email_verified, etc., depending on your Auth0 token configuration

# --- JWKS (JSON Web Key Set) Caching ---
# It's good practice to cache JWKS to avoid fetching it on every request.
# For simplicity in this example, we'll fetch it as needed, but in production, cache it.
_jwks_cache: Optional[Dict[str, Any]] = None

async def get_jwks() -> Dict[str, Any]:
    global _jwks_cache
    # In a real app, add proper caching with expiry
    if _jwks_cache is None:
        async with httpx.AsyncClient() as client:
            try:
                jwks_url = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
                response = await client.get(jwks_url)
                response.raise_for_status() # Raise an exception for HTTP errors
                _jwks_cache = response.json()
            except httpx.HTTPStatusError as e:
                raise AuthError(detail=f"Failed to fetch JWKS: {e.request.url} - {e.response.status_code}", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
            except Exception as e:
                raise AuthError(detail=f"Error fetching JWKS: {str(e)}", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)
    return _jwks_cache

def get_signing_key(token: str) -> Dict[str, Any]:
    try:
        unverified_header = jwt.get_unverified_header(token)
    except JWTError as e:
        raise AuthError(detail=f"Invalid token header: {str(e)}")
    
    jwks = _jwks_cache # Assuming get_jwks has been called and populated cache
    if jwks is None:
        # This should not happen if get_jwks is called appropriately before this function.
        # However, as a fallback or if used independently, one might fetch it here.
        # For this flow, we rely on get_jwks being called during app startup or first use.
        raise AuthError(detail="JWKS not loaded. Call get_jwks first.", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

    rsa_key = {}
    for key in jwks["keys"]:
        if key["kid"] == unverified_header.get("kid"):
            rsa_key = {
                "kty": key["kty"],
                "kid": key["kid"],
                "use": key["use"],
                "n": key["n"],
                "e": key["e"]
            }
            break
    
    if not rsa_key:
        raise AuthError(detail="Unable to find appropriate signing key in JWKS.")
    return rsa_key

async def verify_token(token: str) -> TokenPayload:
    """
    Verifies an Auth0 JWT token.
    1. Fetches JWKS (if not cached).
    2. Gets the appropriate signing key from JWKS based on token's kid.
    3. Decodes and validates the token.
    """
    if _jwks_cache is None: # Ensure JWKS is loaded
        await get_jwks()

    signing_key = get_signing_key(token)

    try:
        payload_dict = jwt.decode(
            token,
            signing_key,
            algorithms=ALGORITHMS,
            audience=API_AUDIENCE, # Verifies 'aud' claim
            issuer=f"https://{AUTH0_DOMAIN}/" # Verifies 'iss' claim
        )
        # Ensure audience is a list for TokenPayload model if that's how it's defined
        if isinstance(payload_dict.get("aud"), str):
            payload_dict["aud"] = [payload_dict["aud"]]
            
        return TokenPayload(**payload_dict)
    except jwt.ExpiredSignatureError:
        raise AuthError(detail="Token has expired.")
    except jwt.JWTClaimsError as e:
        raise AuthError(detail=f"Invalid token claims: {str(e)}")
    except JWTError as e:
        raise AuthError(detail=f"Invalid token: {str(e)}")
    except Exception as e:
        raise AuthError(detail=f"An unexpected error occurred during token validation: {str(e)}", status_code=status.HTTP_500_INTERNAL_SERVER_ERROR)

# --- FastAPI Dependency for getting current user from token ---
# This uses OAuth2Bearer flow for extracting token from Authorization header
oauth2_scheme = OAuth2AuthorizationCodeBearer(
    authorizationUrl=f"https://{AUTH0_DOMAIN}/authorize", # Not directly used by API but good for OpenAPI docs
    tokenUrl=f"https://{AUTH0_DOMAIN}/oauth/token",      # Not directly used by API
    scopes={}
)

async def get_current_user_token_payload(token: str = Depends(oauth2_scheme)) -> TokenPayload:
    """
    FastAPI dependency that verifies the token and returns its payload.
    To be used in path operations that require authentication.
    """
    return await verify_token(token)

# --- Dependency for checking scopes/permissions (RBAC) ---
# This is a more advanced dependency that checks for required scopes/permissions in the token.
class SecurityScopesChecker:
    def __init__(self, required_permissions: Optional[List[str]] = None):
        self.required_permissions = set(required_permissions) if required_permissions else set()

    async def __call__(self, payload: TokenPayload = Depends(get_current_user_token_payload)) -> TokenPayload:
        if not self.required_permissions:
            return payload # No specific permissions required

        token_permissions = set(payload.permissions or [])
        
        for required_perm in self.required_permissions:
            if required_perm not in token_permissions:
                raise AuthError(
                    detail=f"Missing required permission: {required_perm}", 
                    status_code=status.HTTP_403_FORBIDDEN
                )
        return payload

# Example usage of SecurityScopesChecker for an endpoint requiring 'read:data' permission:
# @app.get("/some-protected-data", dependencies=[Depends(SecurityScopesChecker(["read:data"]))])
# async def get_protected_data(payload: TokenPayload = Depends(get_current_user_token_payload)):
#     return {"data": "sensitive data", "user_id": payload.sub}

# Pre-load JWKS on application startup (optional, but good for performance)
async def preload_jwks_on_startup():
    print("Preloading JWKS from Auth0...")
    await get_jwks()
    if _jwks_cache:
        print("JWKS preloaded successfully.")
    else:
        print("Failed to preload JWKS.")

