from models.profile_model import *
from models.business_model import *

async def add_customer_profile(data):
    blob = {"name":"data['name']", "state":"data['state']",
     "country":"data['country']", "gender":"data['gender']",
     "user_id":"data['user_id']"}
    res = await create_profile(blob)
    return res


async def add_business_profile(data):
    blob = {"user_id":"data['user_id']", "business_name":"data['name']",
    "state":"data['state']", "country":"data['country']", "opening_hour":
    "data['opening_hour']", "closing_hour":"data['closing_hour']"}
    res = create_business(blob)
    return res