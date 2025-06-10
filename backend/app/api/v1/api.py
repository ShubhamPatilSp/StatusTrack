from fastapi import APIRouter

from app.api.v1.endpoints import services, incidents, organizations, teams, websockets

api_router_v1 = APIRouter()

api_router_v1.include_router(services.router, prefix="/services", tags=["Services"])
api_router_v1.include_router(incidents.router, prefix="/incidents", tags=["Incidents"])
api_router_v1.include_router(organizations.router, prefix="/organizations", tags=["Organizations"])
api_router_v1.include_router(teams.router, prefix="/teams", tags=["Teams"])
api_router_v1.include_router(websockets.router, prefix="/ws", tags=["WebSockets"])
