from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.api import router
from .store import mongo

app = FastAPI(title="StoryForge")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.on_event("shutdown")
async def _shutdown():
    await mongo.close()
