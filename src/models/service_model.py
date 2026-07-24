from utils.db import supabase

async def create_service(blob):
    res = supabase.tables('business_services').insert(blob).execute()
    return res.blob

async def fetch_all_business_services(business_id):
    res = supabase.table('business_services').select("*").eq("business_id", business_id).execute()
    return res

async def edit_services(blob, user_id, service_id):
    res = supabase.table('business_services').update({"price": blob.get('price'), 
    "service_type": blob.get('service_type'), 
    "duration_in_min": blob.get('duration_in_min')}).eq("user_id", user_id).eq("service_id", service_id).execute()
    return {"success": True}


async def delete_services(service_id):
    res = supabase.table('business_services').delete().eq("service_id", service_id)
    return {"success": True}