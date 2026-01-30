#!/usr/bin/env python3
import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")

print("🔍 Testing MongoDB Connection...")
print(f"URI: {MONGODB_URI[:50]}...")

try:
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
    client.admin.command('ping')
    print("✅ MongoDB connection successful!")
    
    db = client.hrms_lite
    print(f"📊 Database: {db.name}")
    print(f"📁 Collections: {db.list_collection_names()}")
    
except Exception as e:
    print(f"❌ Connection failed: {e}")
    print("\n💡 Troubleshooting:")
    print("1. Verify username and password in MongoDB Atlas")
    print("2. Check if IP address is whitelisted (0.0.0.0/0)")
    print("3. Ensure database user has read/write permissions")
    print("4. If password has special characters, URL-encode them")
