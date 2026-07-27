from models. profile_model import *
from models.business_model import *

async def edit_business_profile(blob, user_id, business_id):
    res = await edit_business(business_id, blob, user_id)
    return res

async def edit_customer_profile(blob, user_id):
    res = await edit_profile(blob, user_id)
    return res