from utils.db import supabase

async def create_profile(blob):
    res = supabase.tables('user_profiles').insert(blob).execute()
    return res.blob

async def get_profile(user_id):
    res = supabase.table('user_profiles').select("*").eq("user_id", user_id).execute()
    return res


async def get_business_profile(user_id, business_id):
    res = supabase.table('user_businesses').select("*").eq("user_id", user_id).eq("business_id", business_id).execute()
    return res


async def edit_business_profile(blob, user_id, business_id):
    res = supabase.table('user_businesses').update({"business_name": blob.get('name'), 
    "business_location": blob.get('location'), "is_verified": blob.get('is_verified'), "opening_hour": blob.get('plan')}).eq("user_id", user_id).select().execute()
    return {"updated_profile": res, "success": True}


async def edit_profile(blob, user_id):
    res = supabase.table('user_profiles').update({"name": blob.get('name'), 
    "location": blob.get('location'), "gender": blob.get('gender'), "is_verified": blob.get('is_verified'), "plan": blob.get('plan')}).eq("user_id", user_id).select().execute()
    return {"updated_profile": res, "success": True}


async def upgrade_plan(user_id, blob):
    res = supabase.tables('user_profiles'). update({"plan": blob.get('plan')}).eq("user_id", user_id).execute()
    return {"success": True}