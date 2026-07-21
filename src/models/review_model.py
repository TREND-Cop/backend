from utils.db import supabase

async def create_review(blob):
    res = supabase.table('business_review').insert().execute()
    return = res.blob



async def delete_review(user_id, business_id, id):
    res = supabase.table('business_review').delete().eq("business_id", business_id).eq("customer_id", user_id).eq("id", id).execute()
    return = {"success": True}



async def get_review(business_id):
    res = supabase.table('business_review').select("*").eq("business_id", business_id).execute()
    return {"reviews": res, "success": True}
    return = res.blob



