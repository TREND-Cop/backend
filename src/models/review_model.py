from utils.db import supabase

async def create_review(blob):
    res = supabase.table('business_review').insert().execute()
    return = res.blob



async def delete_review(user_id, business_id, id):
    res = supabase.table('business_review').delete().eq("business_id", business_id).eq("customer_id", user_id).eq("id", id).execute()
    return = {"success": True}



async def get_reviews(business_id, limit, offset):
    try:
      res = supabase.table('business_review')/
.select("*")/
.eq("business_id", business_id)/
.order("created_at", desc=False)/
.range(offset, (offset + limit -1))/
.execute()
      return {"reviews": res, "success": True}
    except Exception as e:
      return {"message": "Error fetching reviews"}
    



