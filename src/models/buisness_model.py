from utils.db import supabase

async def create_business(blob):
    res = supabase.tables(user_businesses).insert(blob).execute()
    return res.blob

async def edit_services(blob, user_id, business_id):
    res = supabase.table(user_businesses).update({}).eq("user_id", user_id).eq("business_id", business_id).execute()
    return res.blob

async def delete_service(business_id):
    res = supabase.tables(user_businesses).delete().eq("business_id", business_id_id).execute()
    return {"success": True}

async def fetch_all_businesses(user_id):
    res = supabase.table(user_businesses).select