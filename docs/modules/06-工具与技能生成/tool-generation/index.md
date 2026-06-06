# 06.1 工具代码生成

## 业务闭环

```
用户描述需求 → LLM 生成 Python 代码 → AST 验证 → 保存到 tools/ → Agent 可调用
```

## 核心文件

`virtual_team/routers/tools.py`

## 工具格式

```python
# tools/{name}.py
from typing import Any

TOOL_DEF = {
    "name": "tool_name",
    "description": "工具描述",
    "parameters": {
        "type": "object",
        "properties": {
            "param1": {"type": "string", "description": "参数描述"}
        },
        "required": ["param1"]
    }
}

async def run(params: dict[str, Any]) -> str:
    """工具执行函数"""
    return "result"
```

## 生成流程

```python
# tools.py 中的实现
async def generate_tool(request: GenerateRequest, ...) -> ToolMeta:
    # 1. 构建 Prompt
    prompt = TOOL_GENERATION_PROMPT.format(description=request.description)
    
    # 2. 调用 LLM 生成代码
    code = await llm.generate(prompt)
    
    # 3. 验证语法
    ast.parse(code)
    
    # 4. 保存到 tools/ 目录
    file_path = TOOLS_DIR / f"{name}.py"
    file_path.write_text(code)
    
    # 5. 返回工具元数据
    return ToolMeta(name=name, description=description, ...)
```
