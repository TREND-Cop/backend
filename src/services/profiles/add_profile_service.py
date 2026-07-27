from models.profile_model import *
from models.business_model import *

async def add_customer_profile(data):
    blob = {"name":"data['name']", "state":"data['state']",
     "country":"data['country']", "gender":"data['gender']",
     "user_id":"data['user_id']"}
    # call the model function and return


async def add_business_profile(data):
    blob = {"user_id":"data['user_id']", "business_name":"data['name']",
    "state":"data['state']", "country":"data['country']", "opening_hour":
    "data['opening_hour']", "closing_hour":"data['closing_hour']"}
    # call the model function and return