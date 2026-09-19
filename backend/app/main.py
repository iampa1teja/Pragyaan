from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .core.api import router
from .core.utils import data_dir, ensure_dir
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

# Serve generated assets (images) from the data dir at /media/...
app.mount("/media", StaticFiles(directory=str(ensure_dir(data_dir()))), name="media")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.on_event("shutdown")
async def _shutdown():
    await mongo.close()
