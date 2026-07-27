from fastapi import APIRouter, Requests, Header, HTTPException
from middleware.auth.verify_token import verify_token
from middleware.auth.rate_limit import rate_limit
from controllers.profiles.add_profile_controller import verify_profile

router1 = APIRouter(prefix = '/api/customer', tags = ['customers'])
@router1.post('/profile/create')
async def add_router(request: Requests, token: Header(None)):
    if not token:
        raise HTTPException(
            status_code=400,
            detail="Not authorised"
        )
    user_id = await verify_token(token)
    if not user_id:
        raise HTTPException (
            status_code=400,
            detail="Invalid Credentials"
        )
    is_allowed = await rate_limit(user_id)
    if not is_allowed:
        raise HTTPException (
            status_code=429,
            detail="Too many requests"
        )
    blob = request.body()
    blob["user_id"] = user_id
    res = await verify_profile(blob=blob, type="customer")
    return res


router2 = APIRouter(prefix = '/api/business', tags = ['businesses'])
@router2.post('/profile/create')
async def create_router(request: Requests, token: Header(None)):
    if not token:
        raise HTTPException (
            status_code=400,
            detail="Not authorised"
        )
    user_id = await verify_token(token)
    if not user_id:
        raise HTTPException (
            status_code=400,
            detail="Invalid Credentials"
        )
    is_allowed = await rate_limit(user_id)
    if not is_allowed:
        raise HTTPException (
            status_code=429,
            detail="Too many requests"
        )
    blob = request.body()
    blob["user_id"] = user_id
    res = await verify_profile(blob=blob, type="business")
    return res
