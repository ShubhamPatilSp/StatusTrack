from pymongo import MongoClient
from pymongo.database import Database
from .config import settings

class MongoDB:
    client: MongoClient = None
    db: Database = None

mongodb = MongoDB()

def connect_to_mongo():
    mongodb.client = MongoClient(settings.MONGODB_URL)
    mongodb.db = mongodb.client[settings.MONGODB_DB_NAME]
    print(f"Successfully connected to MongoDB: {settings.MONGODB_DB_NAME}")
    # You can add a ping command here to verify connection if needed
    # try:
    #     mongodb.client.admin.command('ping')
    #     print("Pinged your deployment. You successfully connected to MongoDB!")
    # except Exception as e:
    #     print(e)

def close_mongo_connection():
    if mongodb.client:
        mongodb.client.close()
        print("MongoDB connection closed.")

def get_database() -> Database:
    if mongodb.db is None:
        # This case should ideally not happen if connect_to_mongo is called at startup
        print("Warning: Database not initialized. Attempting to connect.")
        connect_to_mongo()
    return mongodb.db

# Example usage for collections (can be defined here or in specific CRUD files)
# def get_users_collection():
#     db = get_database()
#     return db["users"]

# def get_services_collection():
#     db = get_database()
#     return db["services"]