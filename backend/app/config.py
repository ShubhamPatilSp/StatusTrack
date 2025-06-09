from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    MONGODB_URL: str
    MONGODB_DB_NAME: str = "status_page_db"
    AUTH0_DOMAIN: str
    AUTH0_API_AUDIENCE: str
    
    # Auth0 Settings (to be added later)
    # AUTH0_DOMAIN: str
    # AUTH0_API_AUDIENCE: str
    # AUTH0_ISSUER: str
    # AUTH0_ALGORITHMS: str = "RS256"

    # Default to loading from a .env file
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

@lru_cache() # Cache the settings object for performance
def get_settings():
    return Settings()

settings = get_settings()