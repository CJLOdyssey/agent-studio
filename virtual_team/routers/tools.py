"""Tool generation API routes: Generate tools from natural language."""

import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from virtual_team.logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["tools"])


class ToolGenerateRequest(BaseModel):
    description: str = Field(..., min_length=1, max_length=500, description="自然语言描述")
    language: str = Field(default="python", pattern=r'^(python|javascript|typescript)$')


class GeneratedTool(BaseModel):
    id: str
    name: str
    description: str
    code: str
    language: str
    parameters: dict
    is_valid: bool
    error_message: str | None = None


class ToolValidateRequest(BaseModel):
    code: str
    language: str = "python"


class ToolValidateResponse(BaseModel):
    is_valid: bool
    error_message: str | None = None
    suggestions: list[str] = []


@router.post("/api/tools/generate", response_model=GeneratedTool)
async def generate_tool(req: ToolGenerateRequest):
    try:
        tool = _generate_tool_from_description(req.description, req.language)
        return tool
    except Exception as e:
        logger.error("Tool generation failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"工具生成失败: {e}")


@router.post("/api/tools/validate", response_model=ToolValidateResponse)
async def validate_tool(req: ToolValidateRequest):
    try:
        result = _validate_tool_code(req.code, req.language)
        return result
    except Exception as e:
        logger.error("Tool validation failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"验证失败: {e}")


@router.post("/api/tools/execute")
async def execute_tool(code: str, language: str = "python"):
    try:
        result = _execute_tool_sandbox(code, language)
        return {"success": True, "output": result}
    except Exception as e:
        return {"success": False, "error": str(e)}


def _generate_tool_from_description(description: str, language: str) -> GeneratedTool:
    import re
    import hashlib
    
    tool_id = f"tool_{hashlib.md5(description.encode()).hexdigest()[:8]}"
    
    if language == "python":
        return _generate_python_tool(tool_id, description)
    else:
        return _generate_javascript_tool(tool_id, description)


def _generate_python_tool(tool_id: str, description: str) -> GeneratedTool:
    desc_lower = description.lower()
    
    if any(kw in desc_lower for kw in ['读取', 'read', '文件', 'file']):
        name = "read_file"
        desc = "读取文件内容"
        code = '''import os
from typing import Optional

def read_file(file_path: str, encoding: str = "utf-8") -> str:
    """
    读取文件内容
    
    Args:
        file_path: 文件路径
        encoding: 文件编码，默认UTF-8
    
    Returns:
        文件内容字符串
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"文件不存在: {file_path}")
    
    with open(file_path, "r", encoding=encoding) as f:
        return f.read()
'''
        params = {"file_path": {"type": "string", "required": True}, "encoding": {"type": "string", "default": "utf-8"}}
    
    elif any(kw in desc_lower for kw in ['写入', 'write', '保存', 'save']):
        name = "write_file"
        desc = "写入内容到文件"
        code = '''import os
from typing import Optional

def write_file(file_path: str, content: str, encoding: str = "utf-8", append: bool = False) -> bool:
    """
    写入内容到文件
    
    Args:
        file_path: 文件路径
        content: 要写入的内容
        encoding: 文件编码，默认UTF-8
        append: 是否追加模式，默认False（覆盖写入）
    
    Returns:
        是否写入成功
    """
    try:
        mode = "a" if append else "w"
        os.makedirs(os.path.dirname(file_path) if os.path.dirname(file_path) else ".", exist_ok=True)
        with open(file_path, mode, encoding=encoding) as f:
            f.write(content)
        return True
    except Exception as e:
        raise Exception(f"写入文件失败: {e}")
'''
        params = {"file_path": {"type": "string", "required": True}, "content": {"type": "string", "required": True}, "encoding": {"type": "string", "default": "utf-8"}, "append": {"type": "boolean", "default": False}}
    
    elif any(kw in desc_lower for kw in ['搜索', 'search', 'grep', '查找', 'find']):
        name = "search_code"
        desc = "搜索代码中的内容"
        code = '''import os
import re
from typing import List, Dict

def search_code(directory: str, pattern: str, file_extension: str = None) -> List[Dict]:
    """
    在代码目录中搜索匹配的内容
    
    Args:
        directory: 搜索目录
        pattern: 搜索模式（支持正则表达式）
        file_extension: 文件扩展名过滤，如.py, .js
    
    Returns:
        包含文件路径、行号、内容的列表
    """
    results = []
    regex = re.compile(pattern)
    
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file_extension and not file.endswith(file_extension):
                continue
            file_path = os.path.join(root, file)
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    for line_num, line in enumerate(f, 1):
                        if regex.search(line):
                            results.append({
                                "file": file_path,
                                "line": line_num,
                                "content": line.strip()
                            })
            except Exception:
                continue
    
    return results
'''
        params = {"directory": {"type": "string", "required": True}, "pattern": {"type": "string", "required": True}, "file_extension": {"type": "string", "required": False}}
    
    elif any(kw in desc_lower for kw in ['执行', 'exec', '运行', 'run', '命令', 'command', 'shell']):
        name = "run_command"
        desc = "执行Shell命令"
        code = '''import subprocess
from typing import Optional

def run_command(command: str, cwd: str = None, timeout: int = 60) -> dict:
    """
    执行Shell命令并返回结果
    
    Args:
        command: 要执行的命令
        cwd: 工作目录
        timeout: 超时时间（秒），默认60秒
    
    Returns:
        包含stdout、stderr、returncode的字典
    """
    try:
        result = subprocess.run(
            command,
            shell=True,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        return {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
            "success": result.returncode == 0
        }
    except subprocess.TimeoutExpired:
        return {"stdout": "", "stderr": "命令执行超时", "returncode": -1, "success": False}
    except Exception as e:
        return {"stdout": "", "stderr": str(e), "returncode": -1, "success": False}
'''
        params = {"command": {"type": "string", "required": True}, "cwd": {"type": "string", "required": False}, "timeout": {"type": "integer", "default": 60}}
    
    elif any(kw in desc_lower for kw in ['http', '请求', 'request', 'api', 'fetch']):
        name = "http_request"
        desc = "发送HTTP请求"
        code = '''import requests
from typing import Dict, Optional

def http_request(url: str, method: str = "GET", headers: Dict = None, data: dict = None, json_data: dict = None, timeout: int = 30) -> dict:
    """
    发送HTTP请求
    
    Args:
        url: 请求URL
        method: 请求方法（GET, POST, PUT, DELETE）
        headers: 请求头
        data: 表单数据
        json_data: JSON数据
        timeout: 超时时间（秒）
    
    Returns:
        包含status_code、headers、text、json的字典
    """
    try:
        response = requests.request(
            method=method,
            url=url,
            headers=headers,
            data=data,
            json=json_data,
            timeout=timeout
        )
        return {
            "status_code": response.status_code,
            "headers": dict(response.headers),
            "text": response.text,
            "json": response.json() if response.headers.get("content-type", "").startswith("application/json") else None,
            "success": 200 <= response.status_code < 300
        }
    except requests.RequestException as e:
        return {"status_code": 0, "headers": {}, "text": str(e), "json": None, "success": False}
'''
        params = {"url": {"type": "string", "required": True}, "method": {"type": "string", "default": "GET"}, "headers": {"type": "object", "required": False}, "json_data": {"type": "object", "required": False}}
    
    elif any(kw in desc_lower for kw in ['json', '解析', 'parse']):
        name = "parse_json"
        desc = "解析JSON数据"
        code = '''import json
from typing import Any

def parse_json(json_string: str) -> Any:
    """
    解析JSON字符串
    
    Args:
        json_string: JSON字符串
    
    Returns:
        解析后的Python对象
    """
    try:
        return json.loads(json_string)
    except json.JSONDecodeError as e:
        raise ValueError(f"JSON解析失败: {e}")
'''
        params = {"json_string": {"type": "string", "required": True}}
    
    elif any(kw in desc_lower for kw in ['天气', 'weather', '气温', '温度', 'forecast']):
        name = "get_weather"
        desc = "查询城市天气信息"
        code = '''import requests
from typing import Dict, Any

def get_weather(city: str, api_key: str = None) -> Dict[str, Any]:
    """
    查询指定城市的天气信息（使用 OpenWeatherMap API）
    
    Args:
        city: 城市名称（英文），如 "Beijing", "Shanghai"
        api_key: OpenWeatherMap API Key，不传则使用免费接口
    
    Returns:
        包含温度、天气状况、湿度等信息的字典
    """
    if not api_key:
        url = f"https://wttr.in/{city}?format=j1"
        try:
            resp = requests.get(url, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            current = data.get("current_condition", [{}])[0]
            return {
                "city": city,
                "temperature_c": current.get("temp_C", ""),
                "temperature_f": current.get("temp_F", ""),
                "description": current.get("weatherDesc", [{}])[0].get("value", ""),
                "humidity": current.get("humidity", ""),
                "wind_speed_kmph": current.get("windspeedKmph", ""),
                "wind_dir": current.get("winddir16Point", ""),
                "feels_like_c": current.get("FeelsLikeC", ""),
                "visibility": current.get("visibility", ""),
                "pressure": current.get("pressure", ""),
                "success": True
            }
        except Exception as e:
            return {"city": city, "success": False, "error": str(e)}
    else:
        url = "https://api.openweathermap.org/data/2.5/weather"
        params = {"q": city, "appid": api_key, "units": "metric", "lang": "zh_cn"}
        try:
            resp = requests.get(url, params=params, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            return {
                "city": city,
                "temperature_c": data.get("main", {}).get("temp", ""),
                "description": data.get("weather", [{}])[0].get("description", ""),
                "humidity": data.get("main", {}).get("humidity", ""),
                "wind_speed_ms": data.get("wind", {}).get("speed", ""),
                "wind_deg": data.get("wind", {}).get("deg", ""),
                "pressure": data.get("main", {}).get("pressure", ""),
                "success": True
            }
        except Exception as e:
            return {"city": city, "success": False, "error": str(e)}
'''
        params = {"city": {"type": "string", "required": True}, "api_key": {"type": "string", "required": False}}

    elif any(kw in desc_lower for kw in ['数据库', 'database', 'sql']):
        name = "query_database"
        desc = "执行SQL查询"
        code = '''import sqlite3
from typing import List, Dict, Any

def query_database(db_path: str, query: str, params: tuple = None) -> List[Dict]:
    """
    执行SQL查询并返回结果
    
    Args:
        db_path: 数据库文件路径
        query: SQL查询语句
        params: 查询参数
    
    Returns:
        查询结果列表
    """
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        if params:
            cursor.execute(query, params)
        else:
            cursor.execute(query)
        
        if query.strip().upper().startswith("SELECT"):
            results = [dict(row) for row in cursor.fetchall()]
        else:
            conn.commit()
            results = [{"affected_rows": cursor.rowcount}]
        
        conn.close()
        return results
    except Exception as e:
        raise Exception(f"数据库查询失败: {e}")
'''
        params = {"db_path": {"type": "string", "required": True}, "query": {"type": "string", "required": True}, "params": {"type": "tuple", "required": False}}
    
    else:
        name = "custom_tool"
        desc = description[:50]
        code = f'''from typing import Any

def custom_tool(input_data: Any = None) -> Any:
    """
    {description}
    
    Args:
        input_data: 输入数据
    
    Returns:
        处理结果
    """
    # TODO: 实现具体逻辑
    result = input_data
    return result
'''
        params = {"input_data": {"type": "any", "required": False}}
    
    return GeneratedTool(
        id=tool_id,
        name=name,
        description=desc,
        code=code,
        language="python",
        parameters=params,
        is_valid=True
    )


def _generate_javascript_tool(tool_id: str, description: str) -> GeneratedTool:
    desc_lower = description.lower()
    
    if any(kw in desc_lower for kw in ['读取', 'read', '文件', 'file']):
        name = "readFile"
        desc = "读取文件内容"
        code = '''const fs = require('fs').promises;

async function readFile(filePath, encoding = 'utf-8') {
    /**
     * 读取文件内容
     * @param {string} filePath - 文件路径
     * @param {string} encoding - 文件编码，默认UTF-8
     * @returns {Promise<string>} 文件内容
     */
    try {
        const content = await fs.readFile(filePath, encoding);
        return content;
    } catch (error) {
        throw new Error(`读取文件失败: ${error.message}`);
    }
}

module.exports = { readFile };
'''
        params = {"filePath": {"type": "string", "required": True}, "encoding": {"type": "string", "default": "utf-8"}}
    
    elif any(kw in desc_lower for kw in ['天气', 'weather', '气温', '温度', 'forecast']):
        name = "getWeather"
        desc = "查询城市天气信息"
        code = '''async function getWeather(city, apiKey = null) {
    /**
     * 查询指定城市的天气信息（使用 wttr.in 免费接口）
     * @param {string} city - 城市名称（英文），如 "Beijing", "Shanghai"
     * @param {string|null} apiKey - 可选的 OpenWeatherMap API Key
     * @returns {Promise<Object>} 天气信息对象
     */
    try {
        let data;
        if (!apiKey) {
            const resp = await fetch(`https://wttr.in/${city}?format=j1`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            data = await resp.json();
            const current = data.current_condition?.[0] || {};
            return {
                city,
                temperatureC: current.temp_C || '',
                temperatureF: current.temp_F || '',
                description: current.weatherDesc?.[0]?.value || '',
                humidity: current.humidity || '',
                windSpeedKmph: current.windspeedKmph || '',
                windDir: current.winddir16Point || '',
                feelsLikeC: current.FeelsLikeC || '',
                success: true
            };
        } else {
            const resp = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric&lang=zh_cn`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            data = await resp.json();
            return {
                city,
                temperatureC: data.main?.temp || '',
                description: data.weather?.[0]?.description || '',
                humidity: data.main?.humidity || '',
                windSpeedMs: data.wind?.speed || '',
                success: true
            };
        }
    } catch (error) {
        return { city, success: false, error: error.message };
    }
}

module.exports = { getWeather };
'''
        params = {"city": {"type": "string", "required": True}, "apiKey": {"type": "string", "required": False}}
    
    else:
        name = "customTool"
        desc = description[:50]
        code = f'''async function customTool(inputData = null) {{
    /**
     * {description}
     * @param {{*}} inputData - 输入数据
     * @returns {{Promise<*>}} 处理结果
     */
    // TODO: 实现具体逻辑
    return inputData;
}}

module.exports = {{ customTool }};
'''
        params = {"inputData": {"type": "any", "required": False}}
    
    return GeneratedTool(
        id=tool_id,
        name=name,
        description=desc,
        code=code,
        language="javascript",
        parameters=params,
        is_valid=True
    )


def _validate_tool_code(code: str, language: str) -> ToolValidateResponse:
    suggestions = []
    
    if language == "python":
        if "def " not in code:
            suggestions.append("建议添加函数定义")
        if '"""' not in code and "'''" not in code:
            suggestions.append("建议添加文档字符串（docstring）")
        if "import" not in code:
            suggestions.append("检查是否需要导入模块")
        if "try" not in code and "except" not in code:
            suggestions.append("建议添加异常处理")
    
    elif language in ["javascript", "typescript"]:
        if "function " not in code and "=>" not in code:
            suggestions.append("建议添加函数定义")
        if "/**" not in code:
            suggestions.append("建议添加JSDoc注释")
        if "try" not in code and "catch" not in code:
            suggestions.append("建议添加异常处理")
    
    is_valid = len(suggestions) == 0 or (len(suggestions) <= 1 and "建议添加" in suggestions[0])
    
    return ToolValidateResponse(
        is_valid=is_valid,
        error_message=None if is_valid else "代码需要优化",
        suggestions=suggestions
    )


def _execute_tool_sandbox(code: str, language: str) -> str:
    if language == "python":
        try:
            namespace = {}
            exec(code, namespace)
            return "代码语法检查通过"
        except SyntaxError as e:
            raise Exception(f"语法错误: {e}")
        except Exception as e:
            raise Exception(f"执行错误: {e}")
    else:
        return "JavaScript代码验证需要Node.js环境"


# ── CRUD routes ──────────────────────────────────────────────────────────────
from virtual_team.repository import create_tool as repo_create_tool, delete_tool, get_tools as repo_get_tools, update_tool

class ToolCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    category: str = Field(..., min_length=1, max_length=32)
    description: str = ""
    model: str | None = None
    status: str = "active"
    version: str = "v1.0.0"
    endpoint: str = ""
    parameters: str = '{"type":"object","properties":{}}'

class ToolUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    description: str | None = None
    model: str | None = None
    status: str | None = None
    version: str | None = None
    endpoint: str | None = None
    parameters: str | None = None


@router.get("/api/tools")
async def list_tools():
    try:
        return await repo_get_tools()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/tools", status_code=201)
async def add_tool(req: ToolCreate):
    try:
        t = await repo_create_tool(req.model_dump())
        return {"id": t.id, "name": t.name, "category": t.category, "status": t.status, "created_at": t.created_at.isoformat() if t.created_at else None}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/tools/{tool_id}")
async def edit_tool(tool_id: str, req: ToolUpdate):
    try:
        t = await update_tool(tool_id, req.model_dump(exclude_unset=True))
        if not t: raise HTTPException(status_code=404, detail="Tool not found")
        return {"id": t.id, "name": t.name, "category": t.category, "status": t.status}
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/tools/{tool_id}", status_code=204)
async def remove_tool(tool_id: str):
    try:
        ok = await delete_tool(tool_id)
        if not ok: raise HTTPException(status_code=404, detail="Tool not found")
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))
