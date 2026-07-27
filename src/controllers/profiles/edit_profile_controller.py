from services.profiles.edit_profile_service import *

async def verify_edits(blob, user_id, business_id, type):
    if not blob or not user_id:
        return {"message": "Feild not nullable", "success": False}
    if type == "customer":
        edit_details = await edit_customer_profile(blob, user_id)
        return edit_details

    if type == "business":
        edit_details = await edit_business_profile(blob, user_id, business_id)
        return edit_details 