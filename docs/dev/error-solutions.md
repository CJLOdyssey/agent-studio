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

## 2026-06-07 修复记录

### 错误 6: CI pytest 收集失败 — 模块名冲突 (test_prompts)

**错误信息**:
```
import file mismatch:
imported module 'test_prompts' has this __file__ attribute:
  .../tests/unit/repository/test_prompts.py
which is not the same as the test file we want to collect:
  .../tests/unit/test_prompts.py
HINT: remove __pycache__ / .pyc files and/or use a unique basename
```

**原因**: 测试重组时将 `tests/test_prompts.py` 重命名为 `tests/unit/test_prompts.py`，同时新子域 01-01 创建了 `tests/unit/repository/test_prompts.py`。两个文件模块名都是 `test_prompts`，pytest 在收集时报模块名冲突。

**解决方案**: 将旧文件重命名为唯一名称。
```bash
git mv tests/unit/test_prompts.py tests/unit/test_role_prompts.py
```

**涉及文件**: `tests/unit/test_prompts.py` → `tests/unit/test_role_prompts.py`

**预防**: 测试文件重组时需检查模块名唯一性。Python 的 `__pycache__` 会导致 pytest 缓存旧模块路径，需清除。

---

### 错误 7: CI 集成测试步骤找不到文件

**错误信息**:
```
ERROR: file or directory not found: tests/test_integration.py
ERROR: file or directory not found: tests/test_user_flow.py
```

**原因**: `.github/workflows/ci.yml` 中集成测试步骤硬编码了旧路径 `tests/test_integration.py` 和 `tests/test_user_flow.py`，这两个文件在测试重组中被移到了 `tests/integration/` 和 `tests/functional/`。

**解决方案**: 更新 CI 配置文件中的测试路径。
```yaml
# 修改前
run: python -m pytest tests/test_integration.py tests/test_user_flow.py -v --tb=short

# 修改后
run: python -m pytest tests/integration/test_integration.py tests/functional/test_user_flow.py -v --tb=short
```

**涉及文件**: `.github/workflows/ci.yml`

**教训**: 文件路径调整时同步更新所有引用。`grep -r "tests/.*\.py" .github/` 可快速发现硬编码路径。

---

### 错误 8: CI ruff 检查失败 — 预存 lint 问题

**错误现象**: ruff 检测 29 个 lint 错误（全部在测试文件中），导致 CI 门禁不通过。

**问题清单**:

| 规则 | 数量 | 内容 | 文件 |
|------|------|------|------|
| F841 | 8 | 局部变量 `result` 赋值未使用 | `test_conversation.py`, `test_core.py` |
| SIM117 | 2 | 嵌套 with 可合并 | `test_runs_api.py` |
| B017 | 1 | `pytest.raises(Exception)` 盲断言 | `test_config.py` |
| I001 | 若干 | import 未排序 | 多个文件（auto-fix 修复） |
| UP017 | 若干 | 可用 `datetime.UTC` 别名 | 多个文件（auto-fix 修复） |

**原因**: 这些测试文件从 `tests/` 根目录迁移到 `tests/unit/` 后，CI 首次对它执行 ruff 检查。旧路径下的文件不在 CI ruff 扫描范围内（CI 只扫 `tests/` 目录），迁移后暴露了预存问题。

**解决方案**:
```bash
# auto-fix 可自动修复项（I001 排序、UP017 UTC 别名等）
ruff check --fix tests/

# 手动修复 F841：删除未使用的 result 赋值
# 修改前: result = await func(...)
# 修改后: await func(...)

# 手动修复 SIM117：合并嵌套 with
# 修改前: with A: with B as x:
# 修改后: with A, B as x:

# 手动修复 B017：使用具体异常类型
# 修改前: pytest.raises(Exception)
# 修改后: pytest.raises(ValidationError)
```

**涉及文件**: `tests/functional/test_runs_api.py`, `tests/unit/repository/test_conversation.py`, `tests/unit/repository/test_core.py`, `tests/unit/test_config.py`

**教训**: 测试文件重组后首次被 lint 扫描会暴露预存问题。建议在重组后立即 `ruff check tests/` 全量扫描一次。

---

*文档创建时间: 2026-06-06*
*最后更新: 2026-06-07*
