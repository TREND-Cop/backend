from upstash_redis import Redis
from dotenv import load_dotenv
import os

load_dotenv()
url = os.getenv("UPSTASH_URL") 
key = os.getenv("UPSTASH_KEY") 
r = Redis(ur, token=key)