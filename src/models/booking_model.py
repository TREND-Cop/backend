from utils.db import supabase

async def book_service(blob):
    res = supabase('business_bookings').insert(blob).execute()
    return {"success": True}


async def delete_booked_service(id):
    res = supabase('business_bookings').delete().eq("id", id).execute()
    return {"success": True}


async def get_booked_services(business_id):
    res = supabase('business_bookings').select("*").eq("business_id", business_id).order("booked_time", {ascending: True}).execute()
    return {"booked_service": res, "success": True}

