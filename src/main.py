from fastapi import fastAPI
from routers.profiles import *

app = fastAPI()
app.include_router(add_profile_router.router1)
app.include_router(add_profile_router.router2)