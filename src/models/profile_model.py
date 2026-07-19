from utils.db import supabase

async def create_profile(blob):
    response = supabase.tables(user_profiles).insert(blob).execute()
    return response.blob

async def get_profile(user_id):
    res = supabase.table(user_profiles).select("*").eq("user_id", user_id).execute()
    return res.blob

async def edit_profile(blob, user_id):
    res = supabase.table(user_profiles).update({"name": blob.get('name'), 
    "location": blob.get('location'), "gender": blob.get('gender'), "is_verified": blob.get('is_verified'), "plan": blob.get('plan')}).eq("user_id", user_id).execute()