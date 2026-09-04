"""FastAPI 依赖提供者——从基础设施层重新导出。

本模块为 FastAPI 路由提供依赖注入函数，将 ``database.py`` 的基础设施
细节隐藏在仓库边界之后。

用法::

    from repository.deps import get_session
    from sqlalchemy.ext.asyncio import AsyncSession

    @router.get("/items")
    async def list_items(session: AsyncSession = Depends(get_session)):
        ...
"""

from core.infra.database import get_session

__all__ = ["get_session"]
