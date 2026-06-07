"""Prompt version management endpoints for Agent Config."""
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from virtual_team.repository.prompts import activate_prompt, create_prompt, get_prompts

logger = logging.getLogger(__name__)

router = APIRouter()


class PromptCreateRequest(BaseModel):
    content: str
    change_reason: str | None = None


class PromptActivateRequest(BaseModel):
    prompt_id: str


class PromptGenerateRequest(BaseModel):
    description: str = Field(..., min_length=1, max_length=500, description="自然语言描述")


class GeneratedPrompt(BaseModel):
    id: str
    name: str
    description: str
    content: str
    version: str = "v1.0"
    tags: list[str] = []


@router.post("/api/agents/{agent_id}/prompts", status_code=201)
async def create_agent_prompt(agent_id: str, req: PromptCreateRequest):
    try:
        prompt = await create_prompt(
            agent_id=agent_id,
            content=req.content,
            change_reason=req.change_reason,
        )
        return {
            "id": prompt.id,
            "agent_id": prompt.agent_id,
            "version": prompt.version,
            "content": prompt.content,
            "change_reason": prompt.change_reason,
            "is_active": prompt.is_active,
            "created_at": prompt.created_at.isoformat() if prompt.created_at else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error creating prompt: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/agents/{agent_id}/prompts")
async def list_agent_prompts(agent_id: str):
    try:
        prompts = await get_prompts(agent_id)
        return [
            {
                "id": p.id,
                "agent_id": p.agent_id,
                "version": p.version,
                "content": p.content,
                "change_reason": p.change_reason,
                "is_active": p.is_active,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in prompts
        ]
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error listing prompts: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/agents/{agent_id}/prompts/activate")
async def activate_agent_prompt(agent_id: str, req: PromptActivateRequest):
    try:
        prompt = await activate_prompt(agent_id, req.prompt_id)
        if not prompt:
            raise HTTPException(status_code=404, detail="未找到该提示词版本")
        return {
            "id": prompt.id,
            "version": prompt.version,
            "is_active": prompt.is_active,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error activating prompt: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/prompts/generate", response_model=GeneratedPrompt)
async def generate_prompt(req: PromptGenerateRequest):
    try:
        prompt = _generate_prompt_from_description(req.description)
        return prompt
    except Exception as e:
        logger.error("Prompt generation failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"提示词生成失败: {e}")


def _generate_prompt_from_description(description: str) -> GeneratedPrompt:
    import hashlib

    prompt_id = f"prompt_{hashlib.md5(description.encode()).hexdigest()[:8]}"  # nosec
    desc_lower = description.lower()

    if any(kw in desc_lower for kw in ['code review', '代码审查', '代码评审', 'review code', '评审']):
        name = "代码审查助手"
        desc = "执行代码审查，检查代码质量、规范性和潜在问题"
        content = """你是一位资深的代码审查专家。请对以下代码进行全面的审查，重点关注：
1. **代码规范性**：命名约定、格式风格、注释完整性
2. **潜在问题**：空指针、资源泄漏、并发安全、边界条件
3. **性能优化**：算法效率、数据结构选择、冗余计算
4. **最佳实践**：设计模式、SOLID原则、可维护性
5. **安全性**：输入验证、注入防护、权限控制

请输出结构化的审查报告，包含问题分级和具体改进建议。"""
        tags = ["code-review", "质量保证"]

    elif any(kw in desc_lower for kw in ['测试', 'test', '单元测试', 'unit test', '测试用例']):
        name = "测试工程师"
        desc = "生成高质量的测试用例和测试策略"
        content = """你是一位专业的测试工程师。请根据需求或代码生成全面的测试方案：
1. **测试策略**：单元测试、集成测试、端到端测试的覆盖方案
2. **测试用例**：正向用例、边界值用例、异常用例
3. **测试数据**：构造合理的测试数据
4. **Mock策略**：外部依赖的mock方案
5. **断言规范**：清晰的断言表达式和错误信息

优先使用 pytest 框架，确保测试可独立运行且可重复。"""
        tags = ["testing", "质量保证"]

    elif any(kw in desc_lower for kw in ['安全', 'security', '漏洞', 'vulnerability', '渗透', '审计']):
        name = "安全审计专家"
        desc = "执行安全审计，识别安全漏洞和风险"
        content = """你是一位资深的安全审计专家。请对系统进行全面的安全审计：
1. **OWASP Top 10 检查**：注入攻击、认证失效、敏感数据泄露、XML外部实体、访问控制失效等
2. **输入验证**：SQL注入、XSS、CSRF、命令注入防护
3. **认证与授权**：会话管理、JWT安全、OAuth2.0最佳实践
4. **数据安全**：加密存储、传输加密、敏感信息脱敏
5. **基础设施安全**：依赖安全、配置安全、CORS策略

请按风险等级排列发现的问题，并提供具体的修复方案。"""
        tags = ["security", "审计"]

    elif any(kw in desc_lower for kw in ['api', '接口', '接口设计', 'rest', 'graphql']):
        name = "API设计专家"
        desc = "设计符合规范的RESTful API接口"
        content = """你是一位资深的API设计专家。请根据需求设计符合规范的API接口：
1. **资源建模**：识别核心资源及其关系，设计清晰的URL结构
2. **HTTP方法**：正确使用GET/POST/PUT/PATCH/DELETE语义
3. **状态码**：合理使用2xx/3xx/4xx/5xx HTTP状态码
4. **请求/响应设计**：统一的请求体和响应体结构
5. **分页与过滤**：列表接口的分页、排序、过滤参数设计
6. **错误处理**：标准化的错误响应格式
7. **认证与版本管理**：Bearer Token认证，API版本控制策略

请输出完整的API文档，包含每个端点的请求示例和响应示例。"""
        tags = ["api", "设计"]

    elif any(kw in desc_lower for kw in ['文档', 'doc', 'documentation', '注释', 'readme']):
        name = "文档工程师"
        desc = "编写清晰规范的技术文档和API文档"
        content = """你是一位专业的技术文档工程师。请编写清晰、规范的技术文档：
1. **概述**：项目简介、核心功能、技术栈
2. **快速开始**：环境要求、安装步骤、最小化示例
3. **详细使用指南**：配置说明、功能详解、参数参考
4. **API文档**：接口说明、参数表、返回值、示例代码
5. **常见问题**：FAQ和故障排除
6. **贡献指南**：开发环境搭建、代码规范、提交流程

文档应结构清晰、语言准确、示例完整，适合目标读者快速理解和上手。"""
        tags = ["documentation", "文档"]

    elif any(kw in desc_lower for kw in ['部署', 'deploy', 'docker', 'k8s', 'kubernetes', 'ci/cd']):
        name = "DevOps工程师"
        desc = "设计部署方案和CI/CD流水线"
        content = """你是一位经验丰富的DevOps工程师。请设计完整的部署和运维方案：
1. **容器化**：Dockerfile编写，多阶段构建，镜像优化
2. **编排配置**：Docker Compose / Kubernetes manifests
3. **CI/CD流水线**：构建、测试、部署自动化流程
4. **环境管理**：开发/测试/生产环境配置隔离
5. **监控告警**：日志收集、指标监控、告警规则
6. **高可用**：负载均衡、自动扩缩容、健康检查
7. **备份恢复**：数据备份策略、灾难恢复方案

配置应安全、可维护，遵循基础设施即代码的原则。"""
        tags = ["devops", "部署"]

    else:
        name = "自定义提示词"
        desc = description[:50]
        content = f"""你是一位专业的技术助手。请根据以下需求提供帮助：

{description}

请提供：
1. 详细的分析和方案
2. 具体的实施步骤
3. 可能的注意事项
4. 相关的代码示例

以专业、清晰、结构化的方式呈现你的回答。"""
        tags = ["custom"]

    return GeneratedPrompt(
        id=prompt_id,
        name=name,
        description=desc,
        content=content,
        version="v1.0",
        tags=tags,
    )
