"""JWT authentication middleware for FastAPI.

Re-export hub — imports and re-exports everything from:
  - auth_jwt.py (JWT primitives)
  - auth_rbac.py (RBAC types, dependencies, public paths)
  - auth_middleware.py (AuthMiddleware)

``from backend.auth import X`` continues to work as before.
"""

from backend.auth.auth_jwt import *  # noqa: F403
from backend.auth.auth_middleware import *  # noqa: F403
from backend.auth.auth_rbac import *  # noqa: F403
