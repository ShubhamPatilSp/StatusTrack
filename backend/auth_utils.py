import os
import requests
from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt, JWTError
from dotenv import load_dotenv

load_dotenv() # Load environment variables from .env file

AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")
AUTH0_API_AUDIENCE = os.getenv("AUTH0_API_AUDIENCE")
ALGORITHMS = ["RS256"]

if not AUTH0_DOMAIN or not AUTH0_API_AUDIENCE:
    raise EnvironmentError("AUTH0_DOMAIN and AUTH0_API_AUDIENCE must be set in the environment variables or .env file.")

security = HTTPBearer()

# Cache for JWKS
_jwks_cache = None

def get_jwks():
    global _jwks_cache
    # TODO: Consider a more sophisticated caching mechanism with TTL if this becomes a performance bottleneck
    if _jwks_cache is None:
        print("JWKS cache is empty, attempting to fetch.")
        jwks_url = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
        try:
            print(f"Fetching JWKS from: {jwks_url}")
            response = requests.get(jwks_url, timeout=10) # 10 seconds timeout
            print(f"JWKS response status code: {response.status_code}")
            response.raise_for_status() # Raise an exception for HTTP errors (4xx or 5xx)
            _jwks_cache = response.json()
            print("JWKS fetched and cached successfully.")
        except requests.exceptions.Timeout:
            _jwks_cache = None # Reset cache on error
            print(f"Error fetching JWKS: Timeout after 10 seconds for URL {jwks_url}")
            raise HTTPException(status_code=503, detail=f"Could not fetch JWKS: Timeout connecting to {jwks_url}")
        except requests.exceptions.HTTPError as e:
            _jwks_cache = None # Reset cache on error
            print(f"Error fetching JWKS: HTTPError - {e.response.status_code} for URL {jwks_url}. Response: {e.response.text}")
            raise HTTPException(status_code=503, detail=f"Could not fetch JWKS: HTTP error {e.response.status_code} from {jwks_url}")
        except requests.exceptions.RequestException as e:
            _jwks_cache = None # Reset cache on error
            print(f"Error fetching JWKS: RequestException - {e} for URL {jwks_url}")
            raise HTTPException(status_code=503, detail=f"Could not fetch JWKS: {e}")
        except Exception as e: # Catch any other unexpected errors like JSONDecodeError
            _jwks_cache = None
            print(f"Critical Error fetching or parsing JWKS: {e} for URL {jwks_url}")
            raise HTTPException(status_code=500, detail=f"Critical error processing JWKS: {e}")
    else:
        print("Using cached JWKS.")
    return _jwks_cache

def get_current_user_token_payload(credentials: HTTPAuthorizationCredentials = Security(security)):
    print("Attempting to get current user token payload...")
    try:
        token = credentials.credentials
        print(f"Received token: {'******' if token else 'None'}") # Avoid logging full token

        jwks = get_jwks() # get_jwks has its own detailed logging and error handling
        # If get_jwks raises an HTTPException (e.g., 503), it will propagate up.

        print("Attempting to get unverified header from token...")
        unverified_header = jwt.get_unverified_header(token)
        if "kid" not in unverified_header:
            print("Token validation failed: Key ID (kid) not found in token header.")
            raise HTTPException(
                status_code=401,
                detail="Key ID (kid) not found in token header. Cannot verify token."
            )
        
        kid = unverified_header["kid"]
        print(f"Token 'kid': {kid}")
        
        rsa_key = None # Initialize rsa_key to None
        if jwks and "keys" in jwks: # Ensure jwks and jwks['keys'] exist
            for key in jwks["keys"]:
                if key.get("kid") == kid: # Use .get for safety if 'kid' might be missing in a key
                    rsa_key = {
                        "kty": key.get("kty"),
                        "kid": key.get("kid"),
                        "use": key.get("use"),
                        "n": key.get("n"),
                        "e": key.get("e")
                    }
                    print(f"Matching RSA key found in JWKS for kid: {kid}")
                    break
        
        if not rsa_key:
            print(f"Token validation failed: Unable to find appropriate key in JWKS for kid: {kid}. Available KIDs in JWKS: {[k.get('kid') for k in jwks.get('keys', [])]}")
            raise HTTPException(status_code=401, detail=f"Unable to find appropriate key in JWKS to validate token (kid: {kid}).")

        print(f"Attempting to decode token with RSA key (kid: {kid})...")
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=ALGORITHMS,
            audience=AUTH0_API_AUDIENCE,
            issuer=f"https://{AUTH0_DOMAIN}/"
        )
        print("Token decoded and validated successfully.")
        return payload

    except jwt.ExpiredSignatureError:
        print("Token validation failed: ExpiredSignatureError.")
        raise HTTPException(status_code=401, detail="Token has expired.")
    except jwt.JWTClaimsError as e:
        print(f"Token validation failed: JWTClaimsError - {e}.")
        raise HTTPException(status_code=401, detail=f"Incorrect claims, please check the audience and issuer: {e}.")
    except JWTError as e: # Catches other JOSE errors like MalformedPayloadError, InvalidSignatureError etc.
        print(f"Token validation failed: JWTError - {type(e).__name__}: {e}.")
        raise HTTPException(status_code=401, detail=f"Could not validate token: {e}.")
    except HTTPException as e: # Re-raise HTTPExceptions that might come from get_jwks or explicitly raised above
        print(f"HTTPException occurred during token processing: Status {e.status_code}, Detail: {e.detail}")
        raise e 
    except Exception as e: # Catch-all for any other unexpected errors
        print(f"Token validation failed: Unexpected Exception - {type(e).__name__}: {e}")
        # For production, consider logging traceback: import traceback; traceback.print_exc();
        raise HTTPException(status_code=500, detail=f"Unable to process authentication token due to an unexpected server error.")
