from fastapi import APIRouter

from app.api.v1.endpoints import auth, organizations, users, teams, services, incidents, websockets, public, subscribers, metrics

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(organizations.router, prefix="/organizations", tags=["Organizations"])
api_router.include_router(teams.router, prefix="/teams", tags=["Teams"])
api_router.include_router(services.router, prefix="/services", tags=["Services"])
api_router.include_router(incidents.router, prefix="/incidents", tags=["Incidents"])
api_router.include_router(subscribers.router, prefix="/subscribers", tags=["Subscribers"])
api_router.include_router(public.router, prefix="/public", tags=["Public"])
api_router.include_router(websockets.router, prefix="/ws", tags=["WebSockets"])
api_router.include_router(metrics.router, prefix="/metrics", tags=["Metrics"])
