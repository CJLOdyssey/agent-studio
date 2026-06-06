# 10.1 工具生成 Agent

## 业务闭环

```
用户描述工具需求 → tools_agent 分析 → 生成 Python 代码 → 验证 → 保存到 tools/ → 主 Agent 可调用
```

## 核心文件

`system_team/agents/tools_agent.yaml`

## Agent 定义

```yaml
name: tools_agent
description: 工具生成专家，根据用户描述生成可执行的 Python 工具代码
system_prompt: |
  你是一个专业的工具生成专家。你的任务是：
  1. 理解用户对工具的需求
  2. 生成符合项目规范的 Python 代码
  3. 确保代码包含 TOOL_DEF 元数据和 run() 异步函数
  
  工具格式要求：
  - 必须包含 TOOL_DEF 字典（name, description, parameters）
  - 必须包含 async def run(params: dict) 函数
  - 必须有类型注解
tools:
  - code_execution
  - file_operations
```

## 工具格式

```python
# 生成的工具示例
from typing import Any

TOOL_DEF = {
    "name": "calculate",
    "description": "执行数学计算",
    "parameters": {
        "type": "object",
        "properties": {
            "expression": {"type": "string", "description": "数学表达式"}
        },
        "required": ["expression"]
    }
}

async def run(params: dict[str, Any]) -> str:
    """执行数学计算"""
    expression = params.get("expression", "")
    try:
        result = eval(expression)  # 注意：生产环境应使用安全评估
        return str(result)
    except Exception as e:
        return f"计算错误: {str(e)}"
```

## 生成流程

```
用户: "帮我生成一个天气查询工具"
    │
    ▼
tools_agent 接收需求
    │
    ▼
LLM 生成工具代码
    │
    ▼
验证 AST 语法
    │
    ├── 通过 → 保存到 tools/weather.py
    └── 失败 → 重新生成
    │
    ▼
返回结果: "工具 weather 已生成"
```
