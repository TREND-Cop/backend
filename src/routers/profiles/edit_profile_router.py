from fastapi import APIRouter, Requests, Header, HTTPException
from middleware.auth.verify_token import verify_token
from middleware.auth.rate_limit import rate_limit
from controllers.profile.edit_profile_controller import edit_profile


router1 = APIRouter(prefix = '/api/customer', tags=['customer'])
@router1.put('/profile/edit')
async def edit_router(request:Requests, token: Header(None)):
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
    blob = request.body()
    res = await edit_profile(blob, user_id, type="customer")
    return res


router2 = APIRouter(prefix = '/api/business', tags=['business'])
@router2.put('/profile/edit/{business_id}')
async def edit_business(request:Requests, token:Header(None)):
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
    blob = request.body()
    res = await edit_profile(blob, user_id, type="business")
    return res

    


