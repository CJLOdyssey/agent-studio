"""Auth 子包——从单体 auth.py 拆分为领域模块。

端点按关注点组织：
  - login.py:   /login、/refresh、/logout
  - register.py: /send-register-code、/register、/verify、/resend-verification
  - password.py: /forgot-password、/reset-password、/change-password
  - profile.py:  /config、/me、/merge
"""

from fastapi import APIRouter

from . import login, password, profile, register

router = APIRouter(prefix="/api/auth", tags=["auth"])
router.include_router(login.router)
router.include_router(register.router)
router.include_router(password.router)
router.include_router(profile.router)
