"""SQLAlchemy 声明式基类的向后兼容再导出。

真正的定义已迁移到 ``db.base``（零依赖基础设施层），
此处保留 ``from core.base import Base`` 的旧导入路径。
"""

from db.base import Base

__all__ = ["Base"]
