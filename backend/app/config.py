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

    # Email settings for fastapi-mail
    MAIL_USERNAME: str
    MAIL_PASSWORD: str
    MAIL_FROM: str
    MAIL_PORT: int = 587
    MAIL_SERVER: str
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False
    MAIL_FROM_NAME: str = "Status Page"

    # Default to loading from a .env file
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

@lru_cache() # Cache the settings object for performance
def get_settings():
    return Settings()

settings = get_settings()