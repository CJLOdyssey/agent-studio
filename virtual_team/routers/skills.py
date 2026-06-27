"""Skill generation API routes: Generate SKILL.md from natural language."""

import hashlib

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from virtual_team.logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["skills"])


class SkillGenerateRequest(BaseModel):
    description: str = Field(..., min_length=1, max_length=500, description="自然语言描述")
    category: str = Field(default="general", description="Skill 类别")


class GeneratedSkill(BaseModel):
    id: str
    name: str
    description: str
    content: str
    category: str
    is_valid: bool
    error_message: str | None = None


class SkillValidateRequest(BaseModel):
    content: str


class SkillValidateResponse(BaseModel):
    is_valid: bool
    error_message: str | None = None
    suggestions: list[str] = []


@router.post("/api/skills/generate", response_model=GeneratedSkill)
async def generate_skill(req: SkillGenerateRequest):
    try:
        skill = _generate_skill_from_description(req.description, req.category)
        return skill
    except Exception as e:
        logger.error("Skill generation failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Skill 生成失败: {e}") from e


@router.post("/api/skills/validate", response_model=SkillValidateResponse)
async def validate_skill(req: SkillValidateRequest):
    try:
        result = _validate_skill_content(req.content)
        return result
    except Exception as e:
        logger.error("Skill validation failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"验证失败: {e}") from e


def _generate_skill_from_description(description: str, category: str) -> GeneratedSkill:
    desc_lower = description.lower()

    skill_id = f"skill_{hashlib.md5(description.encode()).hexdigest()[:8]}"

    if any(kw in desc_lower for kw in ["代码审查", "code review", "审查", "review"]):
        return _generate_code_review_skill(skill_id, description)
    elif any(kw in desc_lower for kw in ["安全", "security", "漏洞", "vulnerability"]):
        return _generate_security_skill(skill_id, description)
    elif any(kw in desc_lower for kw in ["api", "接口", "接口设计", "restful"]):
        return _generate_api_design_skill(skill_id, description)
    elif any(kw in desc_lower for kw in ["测试", "test", "单元测试", "unit test"]):
        return _generate_testing_skill(skill_id, description)
    elif any(kw in desc_lower for kw in ["文档", "documentation", "readme"]):
        return _generate_documentation_skill(skill_id, description)
    elif any(kw in desc_lower for kw in ["性能", "performance", "优化", "optimization"]):
        return _generate_performance_skill(skill_id, description)
    elif any(kw in desc_lower for kw in ["重构", "refactor", "代码质量"]):
        return _generate_refactoring_skill(skill_id, description)
    elif any(kw in desc_lower for kw in ["git", "提交", "commit", "版本控制"]):
        return _generate_git_workflow_skill(skill_id, description)
    elif any(kw in desc_lower for kw in ["数据库", "database", "sql", "迁移"]):
        return _generate_database_skill(skill_id, description)
    elif any(kw in desc_lower for kw in ["部署", "deploy", "ci/cd", "docker"]):
        return _generate_deployment_skill(skill_id, description)
    else:
        return _generate_custom_skill(skill_id, description)


def _generate_code_review_skill(skill_id: str, description: str) -> GeneratedSkill:
    name = "code-review-standard"
    desc = "专业代码审查能力，检查安全漏洞、性能问题、命名规范"
    content = f"""---
name: {name}
description: {desc}
version: "1.0"
metadata:
  author: system
  category: code-quality
---

# 代码审查规范

## 使用场景
当需要对代码进行审查、Code Review 或代码质量检查时使用。

## 审查流程

### 1. 安全性检查
- SQL 注入风险
- XSS 漏洞
- 硬编码密钥或敏感信息
- 不安全的依赖版本
- 权限校验缺失

### 2. 性能检查
- N+1 查询问题
- 内存泄漏风险
- 不必要的循环或递归
- 缺少缓存策略
- 大数据量处理未分页

### 3. 代码质量
- 命名规范：见名知意，符合语言惯例
- 函数长度：单一职责，不超过 50 行
- 重复代码：提取公共方法
- 异常处理：不能空 catch
- 注释：复杂逻辑必须有注释

### 4. 架构检查
- 模块耦合度
- 依赖方向
- 接口设计合理性

## 输出格式

### 发现的问题
| 严重级别 | 文件位置 | 问题描述 | 修复建议 |
|---------|---------|---------|---------|
| 🔴 严重 | file.py:42 | SQL 注入风险 | 使用参数化查询 |
| 🟡 警告 | file.py:88 | 函数过长 | 拆分为子函数 |

### 总结
- 审查通过 / 需要修改
- 关键问题数量
- 改进建议

## 注意事项
- 保持客观，聚焦代码本身
- 给出具体的修复建议，不要只说"这里有问题"
- 区分必须修复和建议优化
"""
    return GeneratedSkill(
        id=skill_id,
        name=name,
        description=desc,
        content=content,
        category="code-quality",
        is_valid=True,
    )


def _generate_security_skill(skill_id: str, description: str) -> GeneratedSkill:
    name = "security-audit"
    desc = "安全审计能力，检查代码中的安全漏洞和风险"
    content = f"""---
name: {name}
description: {desc}
version: "1.0"
metadata:
  author: system
  category: security
---

# 安全审计规范

## 使用场景
当需要对代码进行安全审计、漏洞扫描或安全评估时使用。

## 审查清单

### 1. 输入验证
- 所有用户输入是否经过验证和清洗
- 是否存在 SQL 注入风险
- 是否存在 XSS 漏洞
- 文件上传是否验证类型和大小

### 2. 认证与授权
- 密码是否加密存储
- Session/Token 管理是否安全
- 权限校验是否完整
- 是否存在越权访问

### 3. 敏感数据
- 硬编码密钥或密码
- 日志中是否泄露敏感信息
- API Key 是否安全存储
- 个人数据是否脱敏

### 4. 依赖安全
- 第三方库是否有已知漏洞
- 依赖版本是否过时
- 是否使用安全的加密算法

## 输出格式

### 发现的漏洞
| 风险等级 | 漏洞类型 | 位置 | 详情 | 修复方案 |
|---------|---------|------|------|---------|
| 🔴 高危 | SQL 注入 | user.py:45 | 直接拼接 SQL | 使用 ORM 或参数化查询 |
| 🟡 中危 | 信息泄露 | log.py:23 | 日志记录密码 | 移除敏感字段 |

## 修复优先级
1. 高危漏洞：立即修复
2. 中危漏洞：24小时内修复
3. 低危漏洞：计划修复
"""
    return GeneratedSkill(
        id=skill_id,
        name=name,
        description=desc,
        content=content,
        category="security",
        is_valid=True,
    )


def _generate_api_design_skill(skill_id: str, description: str) -> GeneratedSkill:
    name = "api-design-guidelines"
    desc = "API 设计规范，遵循 RESTful 最佳实践"
    content = f"""---
name: {name}
description: {desc}
version: "1.0"
metadata:
  author: system
  category: architecture
---

# API 设计规范

## 使用场景
当需要设计、审查或重构 API 接口时使用。

## 设计原则

### 1. RESTful 规范
- 使用正确的 HTTP 方法：GET/POST/PUT/PATCH/DELETE
- 资源命名用复数名词：`/users` 而非 `/user`
- 状态码语义正确：200/201/400/404/500

### 2. 请求/响应格式
```json
// 成功响应
{{"code": 0, "message": "success", "data": {{}}}}

// 错误响应
{{"code": 40001, "message": "参数错误", "details": {{}}}}
```

### 3. 分页规范
```
GET /users?page=1&size=20&sort=created_at,desc

{{
  "total": 100,
  "page": 1,
  "size": 20,
  "items": [...]
}}
```

### 4. 版本管理
- URL 版本：`/api/v1/users`
- Header 版本：`Accept: application/vnd.api.v1+json`

### 5. 认证方式
- Bearer Token：`Authorization: Bearer <token>`
- API Key：`X-API-Key: <key>`

## 检查项
- [ ] URL 命名是否符合 RESTful
- [ ] 状态码是否正确
- [ ] 错误信息是否清晰
- [ ] 是否有参数校验
- [ ] 是否有速率限制
- [ ] 是否有版本管理
"""
    return GeneratedSkill(
        id=skill_id,
        name=name,
        description=desc,
        content=content,
        category="architecture",
        is_valid=True,
    )


def _generate_testing_skill(skill_id: str, description: str) -> GeneratedSkill:
    name = "testing-standards"
    desc = "测试规范，覆盖单元测试、集成测试、E2E 测试"
    content = f"""---
name: {name}
description: {desc}
version: "1.0"
metadata:
  author: system
  category: quality-assurance
---

# 测试规范

## 使用场景
当需要编写、审查或优化测试代码时使用。

## 测试金字塔

### 1. 单元测试 (70%)
- 覆盖核心业务逻辑
- 每个测试用例独立运行
- 使用 Mock 隔离外部依赖
- 命名规范：`test_<功能>_<场景>_<结果>`

```python
def test_calculate_discount_vip_user_returns_20_percent():
    user = User(is_vip=True)
    assert calculate_discount(user) == 0.2
```

### 2. 集成测试 (20%)
- 测试模块间交互
- 测试数据库操作
- 测试外部 API 调用

### 3. E2E 测试 (10%)
- 测试关键用户流程
- 模拟真实用户操作

## 测试质量要求
- 覆盖率 > 80%（核心模块 > 90%）
- 测试执行时间 < 5 分钟
- 无随机失败（Flaky Tests）
- 清晰的测试意图

## 输出格式
### 测试报告
| 模块 | 用例数 | 通过 | 失败 | 覆盖率 |
|------|-------|------|------|--------|
| auth | 25 | 25 | 0 | 92% |
| user | 18 | 17 | 1 | 85% |
"""
    return GeneratedSkill(
        id=skill_id,
        name=name,
        description=desc,
        content=content,
        category="quality-assurance",
        is_valid=True,
    )


def _generate_documentation_skill(skill_id: str, description: str) -> GeneratedSkill:
    name = "documentation-standards"
    desc = "文档编写规范，生成清晰、完整的项目文档"
    content = f"""---
name: {name}
description: {desc}
version: "1.0"
metadata:
  author: system
  category: documentation
---

# 文档编写规范

## 使用场景
当需要编写或优化项目文档、README、API 文档时使用。

## README 模板
```markdown
# 项目名称

简短描述

## 功能特性
- 特性 1
- 特性 2

## 快速开始

### 环境要求
- Python >= 3.8
- Node.js >= 16

### 安装
```bash
pip install -r requirements.txt
```

### 运行
```bash
python app.py
```

## API 文档
| 端点 | 方法 | 描述 |
|------|------|------|
| /api/users | GET | 获取用户列表 |

## 配置说明
| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| DEBUG | false | 调试模式 |

## 贡献指南
1. Fork 项目
2. 创建特性分支
3. 提交 PR

## 许可证
MIT License
```

## 文档质量检查
- [ ] 安装步骤是否完整
- [ ] 使用示例是否可运行
- [ ] API 文档是否清晰
- [ ] 配置说明是否完整
- [ ] 常见问题是否有解答
"""
    return GeneratedSkill(
        id=skill_id,
        name=name,
        description=desc,
        content=content,
        category="documentation",
        is_valid=True,
    )


def _generate_performance_skill(skill_id: str, description: str) -> GeneratedSkill:
    name = "performance-optimization"
    desc = "性能优化规范，识别和解决性能瓶颈"
    content = f"""---
name: {name}
description: {desc}
version: "1.0"
metadata:
  author: system
  category: performance
---

# 性能优化规范

## 使用场景
当需要分析、诊断或优化代码性能时使用。

## 性能检查项

### 1. 数据库优化
- N+1 查询问题
- 缺少索引
- 慢查询日志分析
- 连接池配置

### 2. 缓存策略
- 热点数据缓存
- 缓存穿透/雪崩防护
- 缓存更新策略

### 3. 并发处理
- 异步任务队列
- 并发限制
- 死锁检测

### 4. 资源管理
- 内存泄漏检测
- 连接泄漏
- 文件句柄管理

## 性能指标
- 响应时间 < 200ms (P99)
- QPS > 1000
- 错误率 < 0.1%
- CPU 使用率 < 70%

## 优化输出格式
| 瓶颈点 | 影响范围 | 优化方案 | 预期收益 |
|--------|---------|---------|---------|
| 慢查询 | 用户列表 | 添加索引 | 响应时间 -80% |
| 无缓存 | 商品详情 | Redis 缓存 | QPS +300% |
"""
    return GeneratedSkill(
        id=skill_id,
        name=name,
        description=desc,
        content=content,
        category="performance",
        is_valid=True,
    )


def _generate_refactoring_skill(skill_id: str, description: str) -> GeneratedSkill:
    name = "refactoring-guidelines"
    desc = "代码重构规范，安全、渐进式地改进代码质量"
    content = f"""---
name: {name}
description: {desc}
version: "1.0"
metadata:
  author: system
  category: code-quality
---

# 代码重构规范

## 使用场景
当需要重构代码、改善代码结构或消除技术债务时使用。

## 重构原则
1. 小步修改，频繁测试
2. 不改变外部行为
3. 保持测试覆盖
4. 代码审查确认

## 常用重构模式

### 1. 提取函数
- 函数超过 50 行
- 重复代码出现 3 次以上
- 有独立的逻辑块

### 2. 提取类
- 类职责过多
- 部分字段总是一起使用
- 部分方法总是一起调用

### 3. 重命名
- 变量名不能表达意图
- 函数名与实际行为不符
- 遵循命名规范

### 4. 消除重复
- DRY 原则
- 提取公共方法或基类

## 重构检查清单
- [ ] 现有测试是否通过
- [ ] 是否有足够测试覆盖新代码
- [ ] 是否更新了相关文档
- [ ] 是否破坏了现有 API
- [ ] 代码审查是否通过
"""
    return GeneratedSkill(
        id=skill_id,
        name=name,
        description=desc,
        content=content,
        category="code-quality",
        is_valid=True,
    )


def _generate_git_workflow_skill(skill_id: str, description: str) -> GeneratedSkill:
    name = "git-workflow"
    desc = "Git 工作流规范，提交、分支、合并的最佳实践"
    content = f"""---
name: {name}
description: {desc}
version: "1.0"
metadata:
  author: system
  category: workflow
---

# Git 工作流规范

## 使用场景
当需要处理 Git 操作、提交代码、合并分支时使用。

## 分支规范
- `main` / `master`：生产分支
- `develop`：开发分支
- `feature/*`：特性分支
- `hotfix/*`：紧急修复
- `release/*`：发布分支

## 提交规范
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 类型
- `feat`: 新功能
- `fix`: 修复 Bug
- `docs`: 文档更新
- `style`: 代码格式
- `refactor`: 重构
- `test`: 测试
- `chore`: 构建/工具

### 示例
```
feat(auth): 添加 JWT 认证

- 实现登录接口
- 添加 Token 刷新机制
- 集成权限校验

Closes #123
```

## 合并规范
- 使用 Squash Merge 到 main
- 使用 Merge Commit 到 develop
- 删除已合并分支
- Code Review 通过后合并

## 检查清单
- [ ] 提交信息是否符合规范
- [ ] 是否有冲突需要解决
- [ ] 是否需要更新版本号
- [ ] 是否需要更新 CHANGELOG
"""
    return GeneratedSkill(
        id=skill_id,
        name=name,
        description=desc,
        content=content,
        category="workflow",
        is_valid=True,
    )


def _generate_database_skill(skill_id: str, description: str) -> GeneratedSkill:
    name = "database-standards"
    desc = "数据库设计和操作规范"
    content = f"""---
name: {name}
description: {desc}
version: "1.0"
metadata:
  author: system
  category: database
---

# 数据库规范

## 使用场景
当需要设计数据库结构、编写 SQL 或优化查询时使用。

## 设计规范

### 1. 命名规范
- 表名：复数、小写、下划线分隔（`user_profiles`）
- 字段名：小写、下划线分隔（`created_at`）
- 主键：`id`
- 外键：`<表名>_id`
- 索引：`idx_<字段名>`

### 2. 字段类型
- 时间：`TIMESTAMP` 或 `DATETIME`
- 金额：`DECIMAL(10,2)`
- 状态：`TINYINT` 或 `ENUM`
- 文本：`VARCHAR(n)` 指定长度

### 3. 索引原则
- WHERE 条件字段加索引
- JOIN 字段加索引
- 高选择性字段优先
- 避免过度索引

## SQL 规范
- 关键词大写
- 使用参数化查询
- 避免 SELECT *
- 大数据量分页查询
- 批量操作使用事务

## 检查清单
- [ ] 表结构是否符合范式
- [ ] 是否有必要的索引
- [ ] 是否有外键约束
- [ ] 字段类型是否合适
- [ ] 是否有软删除策略
"""
    return GeneratedSkill(
        id=skill_id,
        name=name,
        description=desc,
        content=content,
        category="database",
        is_valid=True,
    )


def _generate_deployment_skill(skill_id: str, description: str) -> GeneratedSkill:
    name = "deployment-checklist"
    desc = "部署流程规范，确保安全、可靠地发布"
    content = f"""---
name: {name}
description: {desc}
version: "1.0"
metadata:
  author: system
  category: devops
---

# 部署规范

## 使用场景
当需要部署应用、配置 CI/CD 或处理发布流程时使用。

## 部署流程

### 1. 部署前检查
- [ ] 所有测试通过
- [ ] 代码审查完成
- [ ] 版本号更新
- [ ] CHANGELOG 更新
- [ ] 数据库迁移脚本准备

### 2. 部署步骤
```bash
# 拉取最新代码
git pull origin main

# 安装依赖
pip install -r requirements.txt

# 执行数据库迁移
alembic upgrade head

# 重启服务
systemctl restart app
```

### 3. 部署后验证
- [ ] 健康检查接口正常
- [ ] 核心功能验证
- [ ] 日志无异常
- [ ] 监控告警正常

## 回滚方案
1. 保留上一版本镜像/代码
2. 数据库回滚脚本
3. 5 分钟内完成回滚

## 环境管理
- dev：开发环境
- staging：预发布环境
- production：生产环境

## CI/CD 检查清单
- [ ] 自动化测试
- [ ] 代码质量检查
- [ ] 安全扫描
- [ ] 构建产物验证
"""
    return GeneratedSkill(
        id=skill_id, name=name, description=desc, content=content, category="devops", is_valid=True
    )


def _generate_custom_skill(skill_id: str, description: str) -> GeneratedSkill:
    desc = description[:100] if len(description) > 100 else description
    skill_name = description.replace(" ", "-").lower()[:30]

    content = f"""---
name: {skill_name}
description: {desc}
version: "1.0"
metadata:
  author: system
  category: custom
---

# {description}

## 使用场景
{description}

## 执行步骤

### 1. 分析阶段
- 理解用户需求
- 确定输入输出
- 识别约束条件

### 2. 执行阶段
- 按规范执行
- 记录关键决策
- 处理异常情况

### 3. 验证阶段
- 检查执行结果
- 确认符合预期
- 输出执行报告

## 输出格式
- 执行结果
- 关键指标
- 改进建议

## 注意事项
- 保持专业性
- 遵循最佳实践
- 记录执行过程
"""
    return GeneratedSkill(
        id=skill_id,
        name=skill_name,
        description=desc,
        content=content,
        category="custom",
        is_valid=True,
    )


def _validate_skill_content(content: str) -> SkillValidateResponse:
    suggestions = []

    if "---" not in content:
        suggestions.append("缺少 YAML frontmatter（用 --- 包围）")

    if "name:" not in content:
        suggestions.append("frontmatter 中缺少 name 字段")

    if "description:" not in content:
        suggestions.append("frontmatter 中缺少 description 字段")

    if "# " not in content:
        suggestions.append("建议添加一级标题")

    if "## " not in content:
        suggestions.append("建议添加二级标题划分章节")

    if len(content) < 100:
        suggestions.append("内容较短，建议补充更多细节")

    is_valid = len([s for s in suggestions if "缺少" in s]) == 0

    return SkillValidateResponse(is_valid=is_valid, suggestions=suggestions)


# ── CRUD routes ──────────────────────────────────────────────────────────────
from virtual_team.repository import create_skill as repo_create_skill  # noqa: E402
from virtual_team.repository import delete_skill, update_skill  # noqa: E402
from virtual_team.repository import get_skills as repo_get_skills  # noqa: E402


class SkillCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)
    category: str = Field(..., min_length=1, max_length=32)
    description: str = ""
    instructions: str = ""
    prompt_id: str | None = None
    tool_names: list[str] = []
    output_constraint: str = ""


class SkillUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    description: str | None = None
    instructions: str | None = None
    prompt_id: str | None = None
    tool_names: list[str] | None = None
    output_constraint: str | None = None
    status: str | None = None


@router.get("/api/skills")
async def list_skills():
    try:
        return await repo_get_skills()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/api/skills/{skill_id}")
async def get_skill(skill_id: str):
    try:
        skills = await repo_get_skills()
        s = next((sk for sk in skills if sk["id"] == skill_id), None)
        if not s:
            raise HTTPException(status_code=404, detail="Skill not found")
        return s
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/api/skills", status_code=201)
async def add_skill(req: SkillCreate):
    try:
        s = await repo_create_skill(req.model_dump())
        return {
            "id": s.id,
            "name": s.name,
            "category": s.category,
            "status": s.status,
            "prompt_id": s.prompt_id,
            "tool_names": s.tool_names,
            "output_constraint": s.output_constraint,
            "instructions": s.instructions,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.put("/api/skills/{skill_id}")
async def edit_skill(skill_id: str, req: SkillUpdate):
    try:
        s = await update_skill(skill_id, req.model_dump(exclude_unset=True))
        if not s:
            raise HTTPException(status_code=404, detail="Skill not found")
        return {
            "id": s.id,
            "name": s.name,
            "category": s.category,
            "status": s.status,
            "prompt_id": s.prompt_id,
            "tool_names": s.tool_names,
            "output_constraint": s.output_constraint,
            "instructions": s.instructions,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.delete("/api/skills/{skill_id}", status_code=204)
async def remove_skill(skill_id: str):
    try:
        ok = await delete_skill(skill_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Skill not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
