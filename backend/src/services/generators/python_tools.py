"""Python 工具代码生成器。

基于关键词匹配分发到 :mod:`python_templates` 中的模板定义。
回退时生成一个最小桩。
"""

from services.generators._models import GeneratedTool
from services.generators.python_templates import TOOL_TEMPLATES


def _generate_python_tool(tool_id: str, description: str) -> GeneratedTool:
    """返回匹配 *description* 的 :class:`GeneratedTool`。

    遍历 :data:`TOOL_TEMPLATES` 并选取首个关键词列表与描述相交
    （不区分大小写）的模板。若无匹配，返回通用 ``custom_tool`` 桩。
    """
    desc_lower = description.lower()

    for tpl in TOOL_TEMPLATES:
        if any(kw in desc_lower for kw in tpl["keywords"]):
            return GeneratedTool(
                id=tool_id,
                name=tpl["name"],
                description=tpl["desc"],
                code=tpl["code"],
                language="python",
                parameters=tpl["params"],
                is_valid=True,
            )

    # ── 回退：custom_tool 桩 ────────────────────────────────
    name = "custom_tool"
    code = f'''from typing import Any

def custom_tool(input_data: Any = None) -> Any:
    """
    {description}

    Args:
        input_data: 输入数据

    Returns:
        处理结果
    """
    result = input_data
    return result
'''

    return GeneratedTool(
        id=tool_id,
        name=name,
        description=description[:50],
        code=code,
        language="python",
        parameters={"input_data": {"type": "any", "required": False}},
        is_valid=True,
    )
