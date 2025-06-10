import os
import requests
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime
import pymongo

from app.models import User, UserCreate 
from app.database import get_database 
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
    print("AUTH_UTILS: Attempting to get current user token payload...")
    try:
        token = credentials.credentials
        print(f"AUTH_UTILS: Received token: {'******' if token else 'None'}")

        if not token:
            print("AUTH_UTILS: No token provided in credentials.")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated: No token provided.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        print("AUTH_UTILS: Calling get_jwks()...")
        jwks = get_jwks()
        print("AUTH_UTILS: get_jwks() returned.")

        print("AUTH_UTILS: Attempting to get unverified header from token...")
        unverified_header = jwt.get_unverified_header(token)
        print(f"AUTH_UTILS: Unverified header: {unverified_header}")

        if "kid" not in unverified_header:
            print("AUTH_UTILS: Token validation failed: Key ID (kid) not found in token header.")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Key ID (kid) not found in token header. Cannot verify token."
            )
        
        kid = unverified_header["kid"]
        print(f"AUTH_UTILS: Token 'kid': {kid}")
        
        rsa_key = None
        if jwks and "keys" in jwks:
            print(f"AUTH_UTILS: Searching for kid '{kid}' in {len(jwks['keys'])} JWKS keys...")
            for key in jwks["keys"]:
                if key.get("kid") == kid:
                    print(f"AUTH_UTILS: Found matching key for kid '{kid}': {key}")
                    rsa_key = {
                        "kty": key.get("kty"),
                        "kid": key.get("kid"),
                        "use": key.get("use"),
                        "n": key.get("n"),
                        "e": key.get("e")
                    }
                    break
        else:
            print("AUTH_UTILS: JWKS or JWKS keys are missing/invalid.")
        
        if rsa_key is None:
            print(f"AUTH_UTILS: Token validation failed: RSA key not found for kid '{kid}' in JWKS.")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Unable to find appropriate key in JWKS for kid '{kid}'. Token cannot be verified."
            )
        
        print(f"AUTH_UTILS: RSA key found for kid '{kid}'. Attempting to decode token...")
        print(f"AUTH_UTILS: Decoding with: audience='{AUTH0_API_AUDIENCE}', issuer='https://{AUTH0_DOMAIN}/', algorithms={ALGORITHMS}")
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=ALGORITHMS,
            audience=AUTH0_API_AUDIENCE,
            issuer=f"https://{AUTH0_DOMAIN}/"
        )
        print("AUTH_UTILS: Token decoded successfully.")
        
        if "email" not in payload:
            print("AUTH_UTILS: Token validation failed: 'email' claim missing in token payload after decoding.")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Email missing in token payload. Ensure email scope is requested and claim is present."
            )
        
        print(f"AUTH_UTILS: Token payload contains 'email': {payload.get('email')}. Payload: {payload}")
        return payload

    except JWTError as e:
        print(f"AUTH_UTILS: JWTError during token processing: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials due to JWTError: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except HTTPException as e:
        print(f"AUTH_UTILS: HTTPException occurred: {e.detail}, Status: {e.status_code}")
        raise e
    except Exception as e:
        print(f"AUTH_UTILS: Unexpected error in get_current_user_token_payload: {type(e).__name__} - {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred while processing the token: {type(e).__name__} - {e}"
        )

async def get_or_create_db_user(token_payload: dict, db: pymongo.database.Database) -> User:
    print(f"AUTH_UTILS: Attempting to get or create DB user. Token payload keys: {list(token_payload.keys())}")
    users_collection = db["users"]
    
    auth0_id = token_payload.get("sub")
    email = token_payload.get("email")
    name = token_payload.get("name")
    picture = token_payload.get("picture")

    if not auth0_id:
        print("AUTH_UTILS: Error: 'sub' (Auth0 ID) missing in token payload.")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="'sub' (Auth0 ID) missing in token payload.")
    if not email:
        print("AUTH_UTILS: Error: 'email' missing in token payload for get_or_create_db_user.")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="'email' missing in token payload.")

    print(f"AUTH_UTILS: Looking for user with auth0_id: {auth0_id}")
    # ---- BEGIN DEBUG PRINTS ----
    print(f"AUTH_UTILS_DEBUG: Type of db: {type(db)}")
    print(f"AUTH_UTILS_DEBUG: db object: {db}")
    print(f"AUTH_UTILS_DEBUG: Type of users_collection: {type(users_collection)}")
    print(f"AUTH_UTILS_DEBUG: users_collection object: {users_collection}")
    if hasattr(users_collection, 'find_one'):
        print(f"AUTH_UTILS_DEBUG: Type of users_collection.find_one: {type(users_collection.find_one)}")
        print(f"AUTH_UTILS_DEBUG: users_collection.find_one method itself: {users_collection.find_one}")
        try:
            find_one_result_before_await = users_collection.find_one({"auth0_id": auth0_id})
            print(f"AUTH_UTILS_DEBUG: Result of users_collection.find_one() (before await): {find_one_result_before_await}")
            print(f"AUTH_UTILS_DEBUG: Type of result of users_collection.find_one() (before await): {type(find_one_result_before_await)}")
        except Exception as e_debug_call:
            print(f"AUTH_UTILS_DEBUG: Error calling users_collection.find_one() for debugging: {e_debug_call}")
    else:
        print(f"AUTH_UTILS_DEBUG: users_collection has no attribute 'find_one'")
    # ---- END DEBUG PRINTS ----
    try:
        db_user_doc = await users_collection.find_one({"auth0_id": auth0_id})
        # Ensure datetime objects are timezone-aware if not already.
        # Python's datetime.now() without tz defaults to naive. For UTC:
        from datetime import timezone # Add this import if not already at the top of the file
        current_time = datetime.now(timezone.utc)

        if db_user_doc:
            print(f"AUTH_UTILS: User found with auth0_id: {auth0_id}. User document: {db_user_doc}")
            update_fields = {}
            if name and db_user_doc.get("name") != name:
                update_fields["name"] = name
            if picture and db_user_doc.get("picture") != picture:
                update_fields["picture"] = picture
            
            if update_fields:
                update_fields["updated_at"] = current_time
                print(f"AUTH_UTILS: Updating user {auth0_id} with fields: {update_fields}")
                await users_collection.update_one(
                    {"_id": db_user_doc["_id"]},
                    {"$set": update_fields}
                )
                db_user_doc.update(update_fields)
            return User(**db_user_doc)
        else:
            print(f"AUTH_UTILS: User with auth0_id {auth0_id} not found. Creating new user...")
            user_data_for_create = UserCreate(
                auth0_id=auth0_id,
                email=email,
                name=name if name is not None else "",
                picture=picture
            )
            user_doc_to_insert = user_data_for_create.model_dump()
            user_doc_to_insert["created_at"] = current_time
            user_doc_to_insert["updated_at"] = current_time
            
            print(f"AUTH_UTILS: Inserting new user document: {user_doc_to_insert}")
            insert_result = await users_collection.insert_one(user_doc_to_insert)
            created_user_doc = await users_collection.find_one({"_id": insert_result.inserted_id})
            if created_user_doc:
                print(f"AUTH_UTILS: New user created successfully: {created_user_doc}")
                return User(**created_user_doc)
            else:
                print(f"AUTH_UTILS: Error: Failed to retrieve created user after insert for auth0_id {auth0_id}.")
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve created user after insert.")
    except pymongo.errors.DuplicateKeyError as e:
        print(f"AUTH_UTILS: Database error: Duplicate key during user creation/lookup for auth0_id {auth0_id}. Error: {e}")
        import traceback
        traceback.print_exc()
        existing_user_doc = await users_collection.find_one({"auth0_id": auth0_id})
        if existing_user_doc:
            print(f"AUTH_UTILS: Found user {auth0_id} on second attempt after DuplicateKeyError.")
            return User(**existing_user_doc)
        if "email_1" in str(e).lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Email '{email}' is already in use by another account."
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error during user processing: {e}"
        )
    except Exception as e:
        print(f"AUTH_UTILS: Unexpected error in get_or_create_db_user: {type(e).__name__} - {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred while getting or creating user: {type(e).__name__} - {e}"
        )

async def get_current_active_db_user(
    token_payload: dict = Depends(get_current_user_token_payload), 
    db: pymongo.database.Database = Depends(get_database) # Injected database instance
) -> User:
    """Dependency to get the current user from DB, creating or updating if necessary."""
    # get_current_user_token_payload will raise 401 if token is invalid/missing
    # get_database will provide the DB connection
    # This function then uses the token payload to find or create a user in the database.
    # For this example, we assume get_database() provides an async-compatible 'db' object (like Motor's)
    # and that users_collection operations are async.
    print(f"AUTH_UTILS: Entered get_current_active_db_user with token_payload keys: {list(token_payload.keys()) if token_payload else 'None'}")
    try:
        user = await get_or_create_db_user(token_payload, db)
        print(f"AUTH_UTILS: get_or_create_db_user returned user: {user.email if user else 'None'}")
        return user
    except Exception as e:
        print(f"AUTH_UTILS: Unexpected error in get_current_active_db_user wrapper: {type(e).__name__} - {e}")
        import traceback
        traceback.print_exc()
        if not isinstance(e, HTTPException):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Critical error in user processing: {type(e).__name__} - {e}"
            )
        raise e
