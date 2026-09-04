"""独立数据库基础设施层 —— 零业务依赖的声明式基类。

本包只放 ORM 声明式基类 ``Base``，供 ``orm`` 与 ``core.infra.database``
共同依赖，从而打破 ``orm ↔ core`` 的循环依赖。
"""
