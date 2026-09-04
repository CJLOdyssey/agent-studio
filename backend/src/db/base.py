"""SQLAlchemy 声明式基类。

所有 ORM 模型继承自 ``Base``，其 ``metadata`` 承载全量表定义，
供 ``create_all`` 与 Alembic 迁移使用。
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """所有 ORM 模型的声明式基类。"""
