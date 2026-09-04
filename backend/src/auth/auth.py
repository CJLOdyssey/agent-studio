"""FastAPI 的 JWT 认证中间件。

再导出中枢 —— 从以下模块导入并再导出全部内容：
  - auth_jwt.py（JWT 原语）
  - auth_rbac.py（RBAC 类型、依赖、公开路径）
  - auth_middleware.py（AuthMiddleware）

``from auth import X`` 继续照常可用。
"""

from auth.auth_jwt import *  # noqa: F403
from auth.auth_middleware import *  # noqa: F403
from auth.auth_rbac import *  # type: ignore[assignment]  # noqa: F403
