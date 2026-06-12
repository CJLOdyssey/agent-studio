"""提示词生成器 — 自然语言描述 → Agent 系统提示词."""
from __future__ import annotations

import hashlib

from virtual_team.generation.generators.base import (
    BaseGenerator,
    GenerateRequest,
    GenerateResponse,
)

TEMPLATES: dict = {
    "code_review": {
        "keywords": ["审查", "code review", "代码质量", "review"],
        "name": "代码审查助手",
        "content": """你是一位资深的代码审查专家。请对以下代码进行全面的审查，重点关注：
1. **代码规范性**：命名约定、格式风格、注释完整性
2. **潜在问题**：空指针、资源泄漏、并发安全、边界条件
3. **性能优化**：算法效率、数据结构选择、冗余计算
4. **最佳实践**：设计模式、SOLID原则、可维护性
5. **安全性**：输入验证、注入防护、权限控制

请输出结构化的审查报告，包含问题分级和具体改进建议。""",
        "tags": ["code-review", "质量保证"],
    },
    "testing": {
        "keywords": ["测试", "test", "单元测试", "集成测试"],
        "name": "测试工程师",
        "content": """你是一位专业的测试工程师，负责编写和执行测试用例。
请根据以下需求设计全面的测试方案，包括：
1. 单元测试：覆盖核心逻辑、边界条件、异常路径
2. 集成测试：验证模块间交互、数据流一致性
3. 测试数据准备：输入输出样例
4. 自动化测试策略""",
        "tags": ["testing", "质量保证"],
    },
    "security": {
        "keywords": ["安全", "security", "漏洞", "审计"],
        "name": "安全审计专家",
        "content": """你是一位网络安全专家，负责对系统进行安全审计。
请对以下内容进行安全评估：
1. 认证与授权机制
2. 输入验证与防注入
3. 敏感数据加密与存储
4. 会话管理与CSRF防护
5. API安全与速率限制""",
        "tags": ["security", "安全"],
    },
    "api_design": {
        "keywords": ["api", "接口", "rest", "api设计"],
        "name": "API设计师",
        "content": """你是一位经验丰富的API设计师，负责设计高质量API。
请遵循RESTful设计规范，关注：
1. 资源命名与URI设计
2. 请求/响应格式
3. 错误处理与状态码
4. 版本管理策略
5. 安全认证方案""",
        "tags": ["api", "设计"],
    },
}


class PromptGenerator(BaseGenerator):
    """自然语言描述 → Agent 系统提示词."""

    def generate(self, request: GenerateRequest) -> GenerateResponse:
        prompt_id = f"prompt_{hashlib.md5(request.description.encode(), usedforsecurity=False).hexdigest()[:8]}"
        template = self._match_template(request.description)

        if template:
            return GenerateResponse(
                id=prompt_id,
                name=template["name"],
                description=request.description[:100],
                content=template["content"],
                metadata={"version": "v1.0", "tags": template["tags"]},
            )
        return GenerateResponse(
            id=prompt_id,
            name="自定义提示词",
            description=request.description[:100],
            content=f"请根据以下需求执行任务：\n{request.description}\n\n请确保输出清晰、完整、可执行。",
            metadata={"version": "v1.0", "tags": ["custom"]},
        )

    def supported_keywords(self) -> list[str]:
        return [kw for t in TEMPLATES.values() for kw in t["keywords"]]

    def _match_template(self, description: str) -> dict | None:
        desc_lower = description.lower()
        for template in TEMPLATES.values():
            if any(kw in desc_lower for kw in template["keywords"]):
                return template
        return None
