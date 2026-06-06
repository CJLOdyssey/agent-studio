# 历史错误及解决方案

## 2026-06-06 修复记录

### 错误 1: CI/CD Ruff Linter - 变量命名规范 (N806)

**错误信息**:
```
virtual_team/database.py:324:9: N806 Variable `_MIGRATIONS` in function should be lowercase
```

**原因**: Python 命名规范要求函数内变量使用小写字母，`_MIGRATIONS` 使用了大写。

**解决方案**:
```python
# 修改前
_MIGRATIONS = [...]

# 修改后
_migrations = [...]
```

**涉及文件**: `virtual_team/database.py`

---

### 错误 2: CI/CD Ruff Linter - 行长度超限 (E501)

**错误信息**:
```
virtual_team/repository/core.py:322:121: E501 Line too long (132 > 120)
```

**原因**: 函数签名超过 120 字符限制。

**解决方案**:
```python
# 修改前
async def get_session_messages(session_id: str, exclude_run_id: str | None = None, user_id: str | None = None) -> list[ChatMessage]:

# 修改后
async def get_session_messages(
    session_id: str,
    exclude_run_id: str | None = None,
    user_id: str | None = None,
) -> list[ChatMessage]:
```

**涉及文件**: `virtual_team/repository/core.py`

---

### 错误 3: CI/CD Mypy - 类型注解错误

**错误信息**:
```
virtual_team/routers/attachments.py:60: error: Incompatible default for parameter "request" (default has type "None", parameter has type "Request[State]")
```

**原因**: FastAPI 路由参数 `request: Request = None` 类型不兼容。

**解决方案**:
```python
# 修改前
async def upload_attachment(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    run_id: str | None = Form(None),
    request: Request = None,
):

# 修改后
async def upload_attachment(
    request: Request,
    file: UploadFile = File(...),
    session_id: str = Form(...),
    run_id: str | None = Form(None),
):
```

**关键点**: FastAPI 要求 `Request` 参数不能有默认值，且必须放在 Form 参数前面。

**涉及文件**: `virtual_team/routers/attachments.py`

---

### 错误 4: 前端 i18n 翻译 Key 缺失

**错误现象**: 输入框显示 `chatInput.placeholder` 而非中文文本

**错误原因**: `DevAgentsWorkstation.tsx` 中使用了不存在的翻译 key `chatInput.placeholder`

**解决方案**:
```typescript
// 修改前
placeholder={t('chatInput.placeholder')}

// 修改后
placeholder={t('home.placeholder')}
```

**正确 key**: `home.placeholder` → "描述你的需求，我来帮你分析和规划..."

**涉及文件**: `frontend/src/components/devagents/DevAgentsWorkstation.tsx`

---

### 错误 5: FastAPI 参数顺序问题

**错误信息**:
```
SyntaxError: parameter without a default follows parameter with a default
```

**原因**: Python 语法要求必需参数不能在可选参数后面。

**错误示例**:
```python
# 错误 - request 是必需参数，但放在了有默认值的 run_id 后面
async def upload_attachment(
    file: UploadFile = File(...),      # 有默认值
    session_id: str = Form(...),       # 有默认值
    request: Request,                  # 无默认值 ❌
    run_id: str | None = Form(None),  # 有默认值
):
```

**解决方案**: 将必需参数放在最前面：
```python
# 正确
async def upload_attachment(
    request: Request,                  # 无默认值，放最前
    file: UploadFile = File(...),      # 有默认值
    session_id: str = Form(...),       # 有默认值
    run_id: str | None = Form(None),  # 有默认值
):
```

---

## 通用经验总结

### 1. Python 命名规范
- 函数内变量：小写字母 + 下划线 (`_migrations`)
- 常量：大写字母 + 下划线 (`MAX_RETRIES`)
- 类名：驼峰命名 (`AgentConfigDB`)

### 2. 行长度限制
- 默认限制：120 字符
- 长函数签名：使用多行格式
- 长字符串：使用括号或反斜杠换行

### 3. FastAPI 参数顺序
- `Request` 参数：无默认值，放最前面
- `Form` / `File` 参数：有默认值，放后面
- 可选参数：放最后

### 4. 类型注解
- FastAPI 不支持 `Request = None` 这种可选 Request
- 使用 `Request` 作为必需参数
- 如果需要可选，使用 `Depends` 模式

### 5. i18n 翻译
- Key 必须在语言文件中定义
- 使用 `t('namespace.key')` 格式
- 缺失 key 会显示原始字符串

---

*文档创建时间: 2026-06-06*
*最后更新: 2026-06-06*
