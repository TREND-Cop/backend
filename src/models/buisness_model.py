from utils.db import supabase 

async def create_business(blob):
    res = supabase.table('user_buisnesses').insert(blob).execute()
    return res.blob


async def get_all_user_businesses(user_id):
    res = supabase.table('user_businesses').select("*").eq("user_id", user_id).execute()
    return res


async def get_one_business(business_id):
    res = supabase.table('user_businesses').select("*").eq("business_id", business_id).execute()
    return res


async def delete_business(business_id):
    res = supabase.table('user_businesses').delete().eq("business_id", business_id).execute()
    return {"success": True}


async def edit_business(business_id, blob):
    res = supabase.table('user_businesses').update({"business_name": blob.get('name'), "business_location": blob.get('location'), "opening_hour": blob.get('opening_hour'), "closing_hour": blob.get('closing_hour')}).eq("business_id", business_id).execute()
    return {"success": True}



