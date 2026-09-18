from motor.motor_asyncio import AsyncIOMotorClient
from ..core.config import get_settings

_client: AsyncIOMotorClient | None = None 

def get_client() -> AsyncIOMotorClient: 
    global _client 
    if _client is None: 
        settings = get_settings() 
        _client = AsyncIOMotorClient(settings.mongo_uri) 

    return _client 

def get_db(): 
    settings = get_settings() 
    return get_client()[settings.mongodb_database] 

def stories():
    return get_db()["stories"]

def chats():
    return get_db()["chats"]

def assets():
    return get_db()["assets"]

def users():
    return get_db()["users"]

async def close():
    global _client
    if _client is not None:
        _client.close()
        _client = None