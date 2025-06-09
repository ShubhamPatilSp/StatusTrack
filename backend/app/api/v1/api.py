from fastapi import APIRouter

# Import the services router
from app.api.v1.endpoints import services, incidents, organizations, teams, websockets

# Create the main v1 API router
api_router_v1 = APIRouter()

# Include the services router
api_router_v1.include_router(services.router, prefix="/services", tags=["Services"])

# Include the incidents router
api_router_v1.include_router(incidents.router, prefix="/incidents", tags=["Incidents"])

# Include the organizations router
api_router_v1.include_router(organizations.router, prefix="/organizations", tags=["Organizations"])

# Include the teams router
api_router_v1.include_router(teams.router, prefix="/teams", tags=["Teams"])

# Include the WebSockets router
api_router_v1.include_router(websockets.router, tags=["WebSockets"])
