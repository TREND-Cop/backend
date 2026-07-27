from fastapi import APIRouter, Requests, Header, HTTPException
from middleware.auth.verify_token import verify_token
from middleware.auth.rate_limit import rate_limit
from controllers.profile.get_profile_controller import get_profile_by_id


router1 = APIRouter(prefix = '/api/customer', tags=['customer'])
@router1.get('/profile/get/{user_id}')
async def edit_router(user_id: str(user_id), token: Header(None)):
    if not token:
        raise HTTPException (
            status_code=400,
            detail="Not authorised"
        )
    user_id = await verify_token(token)
    if not user_id:
        raise HTTPException(
            status_code=400,
            detail="Invalid Credentials"
        )
    is_allowed = await rate_limit(user_id)
    if not is_allowed:
        raise HTTPException (
            status_code=429,
            detail="Too many request"
        )
    res = await get_profile_by_id(id=user_id, type="business")
    return res


router2 = APIRouter(prefix = '/api/business', tags=['business'])
@router2.put('/profile/get/{business_id}')
async def edit_business(business_id: str(business_id), token:Header(None)):
    if not token:
        raise HTTPException(
            status_code=400,
            detail="Not authorized"
        )
    user_id = await verify_token(token)
    if not user_id:
        raise HTTPException(
            status_code=400,
            detail="Invalid Credentials"
        )
    is_allowed = await rate_limit(user_id)
    if not is_allowed:
        raise HTTPException (
            status_code=429,
            detail="Too many request"
        )
    res = await get_profile_by_id(id=business_id, type="business")
    return res

    


