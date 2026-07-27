from services.profiles.add_profile_service import *

async def verify_profile(blob, type):
  if not blob:
    return {"message": "Field not nullable", "success": False}
    
  if type == "customer":
    customer_details = await add_customer_profile(blob)
    return customer_details

  if type == "business":
    business_details = await add_business_profile(blob)
    return business_details
  