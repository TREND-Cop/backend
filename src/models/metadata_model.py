from utils.db import supabase

async def upload_image(blob):
    res = supabase.table('user_metadata').insert(blob).execute()
    return {"success": True}


async def delete_image(user_id, id):
    res = supabase.table('user_metadata').delete().eq("id", id).eq("user_id", user_id).execute()
    return {"success": True}


async def get_profile_image_url(user_id):
   res = supabase.table('user_metadata').select("url").eq("user_id", user_id).eq("description", "profile").execute()
    return {"image_url": res, "success": True}


async def get_business_image_url(business_id, limit):
   res = supabase.table('user_metadata').select("url").eq("business_id", business_id).limit(limit).execute()
    return {"image_url": [res], "success": True}


async def edit_image(id, user_id, new_url):
    # he passes in the old_url in the controller
    res = supabase.table('user_metadata).update({"url": new_url}).eq("id", id).eq("user_id", user_id).select().execute()
    return {"updated_image": new_url, "success": True}


