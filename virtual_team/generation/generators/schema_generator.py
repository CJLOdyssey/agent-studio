"""输出格式生成器 — 自然语言描述 → JSON Schema 定义."""
from __future__ import annotations

import hashlib
import json

from virtual_team.generation.generators.base import (
    BaseGenerator,
    GenerateRequest,
    GenerateResponse,
)

SCHEMA_TEMPLATES: dict = {
    "prd": {
        "keywords": ["prd", "产品需求", "需求文档", "product requirement"],
        "name": "prd-output",
        "description": "产品需求文档输出格式",
        "schema_def": {
            "type": "object",
            "required": ["project_name", "version", "overview", "requirements"],
            "properties": {
                "project_name": {"type": "string", "description": "项目名称"},
                "version": {"type": "string", "description": "版本号"},
                "author": {"type": "string", "description": "文档作者"},
                "overview": {"type": "string", "description": "项目概述"},
                "objectives": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "项目目标列表"
                },
                "requirements": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"},
                            "title": {"type": "string"},
                            "description": {"type": "string"},
                            "priority": {"type": "string", "enum": ["P0", "P1", "P2", "P3"]},
                            "status": {"type": "string", "enum": ["待评审", "已通过", "开发中", "已完成"]},
                            "acceptance_criteria": {
                                "type": "array",
                                "items": {"type": "string"}
                            }
                        }
                    },
                    "description": "需求列表"
                },
                "timeline": {
                    "type": "object",
                    "properties": {
                        "start_date": {"type": "string", "format": "date"},
                        "target_date": {"type": "string", "format": "date"},
                        "milestones": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "name": {"type": "string"},
                                    "date": {"type": "string", "format": "date"},
                                    "deliverables": {
                                        "type": "array",
                                        "items": {"type": "string"}
                                    }
                                }
                            }
                        }
                    }
                },
                "risks": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "description": {"type": "string"},
                            "impact": {"type": "string", "enum": ["高", "中", "低"]},
                            "mitigation": {"type": "string"}
                        }
                    }
                }
            }
        },
        "example": {
            "project_name": "示例项目",
            "version": "v1.0.0",
            "author": "张三",
            "overview": "构建一个用户管理系统",
            "objectives": ["提高用户管理效率", "统一身份认证"],
            "requirements": [
                {
                    "id": "REQ-001",
                    "title": "用户注册",
                    "description": "支持邮箱和手机号注册",
                    "priority": "P0",
                    "status": "待评审",
                    "acceptance_criteria": ["用户输入邮箱后30秒内收到验证码"]
                }
            ],
            "timeline": {
                "start_date": "2025-01-01",
                "target_date": "2025-03-31",
                "milestones": [
                    {"name": "需求评审完成", "date": "2025-01-15", "deliverables": ["PRD 文档", "原型图"]}
                ]
            },
            "risks": [
                {"description": "第三方 API 依赖不稳定", "impact": "高", "mitigation": "增加降级方案"}
            ]
        },
    },
    "code_review": {
        "keywords": ["代码审查", "code review", "审查", "review"],
        "name": "code-review-output",
        "description": "代码审查报告输出格式",
        "schema_def": {
            "type": "object",
            "required": ["review_id", "reviewer", "summary", "issues"],
            "properties": {
                "review_id": {"type": "string", "description": "审查编号"},
                "reviewer": {"type": "string", "description": "审查人"},
                "project": {"type": "string", "description": "项目名称"},
                "branch": {"type": "string", "description": "审查分支"},
                "files_changed": {"type": "integer", "description": "变更文件数"},
                "summary": {"type": "string", "description": "审查总结"},
                "verdict": {"type": "string", "enum": ["通过", "需要修改", "拒绝"]},
                "issues": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"},
                            "file": {"type": "string"},
                            "line": {"type": "integer"},
                            "severity": {"type": "string", "enum": ["严重", "警告", "建议"]},
                            "category": {"type": "string", "enum": ["安全性", "性能", "可读性", "架构", "规范"]},
                            "description": {"type": "string"},
                            "suggestion": {"type": "string"}
                        }
                    }
                },
                "metrics": {
                    "type": "object",
                    "properties": {
                        "critical_count": {"type": "integer"},
                        "warning_count": {"type": "integer"},
                        "suggestion_count": {"type": "integer"},
                        "score": {"type": "number", "minimum": 0, "maximum": 100}
                    }
                }
            }
        },
        "example": {
            "review_id": "CR-001",
            "reviewer": "李四",
            "project": "user-service",
            "branch": "feature/user-auth",
            "files_changed": 5,
            "summary": "整体代码质量良好，发现一处 SQL 注入风险",
            "verdict": "需要修改",
            "issues": [
                {
                    "id": "ISSUE-001",
                    "file": "auth/login.py",
                    "line": 42,
                    "severity": "严重",
                    "category": "安全性",
                    "description": "用户输入直接拼接到 SQL 查询",
                    "suggestion": "使用参数化查询或 ORM"
                }
            ],
            "metrics": {
                "critical_count": 1,
                "warning_count": 3,
                "suggestion_count": 5,
                "score": 72
            }
        },
    },
    "test_report": {
        "keywords": ["测试报告", "test report", "测试结果", "test result"],
        "name": "test-report-output",
        "description": "测试报告输出格式",
        "schema_def": {
            "type": "object",
            "required": ["test_id", "summary", "results"],
            "properties": {
                "test_id": {"type": "string", "description": "测试报告编号"},
                "project": {"type": "string", "description": "项目名称"},
                "test_type": {"type": "string", "enum": ["单元测试", "集成测试", "E2E", "性能测试"]},
                "executor": {"type": "string", "description": "执行人"},
                "execution_date": {"type": "string", "format": "date-time"},
                "summary": {"type": "string", "description": "测试总结"},
                "results": {
                    "type": "object",
                    "properties": {
                        "total": {"type": "integer", "description": "总用例数"},
                        "passed": {"type": "integer", "description": "通过数"},
                        "failed": {"type": "integer", "description": "失败数"},
                        "skipped": {"type": "integer", "description": "跳过数"},
                        "pass_rate": {"type": "number", "description": "通过率"},
                        "coverage": {"type": "number", "description": "代码覆盖率(%)"},
                        "duration_seconds": {"type": "number", "description": "执行耗时(秒)"}
                    }
                },
                "failures": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "test_name": {"type": "string"},
                            "expected": {"type": "string"},
                            "actual": {"type": "string"},
                            "error_message": {"type": "string"},
                            "stack_trace": {"type": "string"}
                        }
                    }
                }
            }
        },
        "example": {
            "test_id": "TEST-001",
            "project": "user-service",
            "test_type": "单元测试",
            "executor": "王五",
            "execution_date": "2025-01-15T10:30:00",
            "summary": "核心模块测试通过，2 个边界用例失败",
            "results": {
                "total": 120,
                "passed": 118,
                "failed": 2,
                "skipped": 0,
                "pass_rate": 98.3,
                "coverage": 85.6,
                "duration_seconds": 45.2
            },
            "failures": [
                {
                    "test_name": "test_login_empty_password",
                    "expected": "返回 400 错误",
                    "actual": "返回 500 错误",
                    "error_message": "AssertionError: expected 400, got 500",
                    "stack_trace": "Traceback (most recent call last): ..."
                }
            ]
        },
    },
    "technical_design": {
        "keywords": ["技术方案", "technical design", "技术设计", "架构方案"],
        "name": "technical-design-output",
        "description": "技术方案输出格式",
        "schema_def": {
            "type": "object",
            "required": ["title", "version", "overview", "architecture"],
            "properties": {
                "title": {"type": "string", "description": "方案标题"},
                "version": {"type": "string", "description": "版本号"},
                "author": {"type": "string", "description": "作者"},
                "overview": {"type": "string", "description": "方案概述"},
                "background": {"type": "string", "description": "背景和动机"},
                "requirements_summary": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "需求摘要"
                },
                "architecture": {
                    "type": "object",
                    "properties": {
                        "diagram": {"type": "string", "description": "架构图链接"},
                        "components": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "name": {"type": "string"},
                                    "description": {"type": "string"},
                                    "responsibility": {"type": "string"},
                                    "tech_stack": {
                                        "type": "array",
                                        "items": {"type": "string"}
                                    }
                                }
                            }
                        },
                        "data_flow": {"type": "string", "description": "数据流描述"}
                    }
                },
                "technology_stack": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "version": {"type": "string"},
                            "purpose": {"type": "string"}
                        }
                    },
                    "description": "技术栈"
                },
                "tradeoffs": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "decision": {"type": "string"},
                            "alternatives": {
                                "type": "array",
                                "items": {"type": "string"}
                            },
                            "reason": {"type": "string"}
                        }
                    }
                },
                "risks": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "risk": {"type": "string"},
                            "probability": {"type": "string", "enum": ["高", "中", "低"]},
                            "mitigation": {"type": "string"}
                        }
                    }
                }
            }
        },
        "example": {
            "title": "用户服务微服务化方案",
            "version": "v1.0",
            "author": "张三",
            "overview": "将单体用户模块拆分为独立微服务",
            "background": "当前单体架构用户模块耦合度较高，需要独立部署和扩展",
            "requirements_summary": [
                "支持独立部署和弹性伸缩",
                "兼容现有接口协议"
            ],
            "architecture": {
                "diagram": "https://example.com/arch.png",
                "components": [
                    {
                        "name": "user-api",
                        "description": "用户 API 网关层",
                        "responsibility": "请求路由、参数校验、鉴权",
                        "tech_stack": ["FastAPI", "Pydantic", "Redis"]
                    }
                ],
                "data_flow": "客户端 -> API Gateway -> user-api -> PostgreSQL"
            },
            "technology_stack": [
                {"name": "FastAPI", "version": "0.115.x", "purpose": "API 框架"},
                {"name": "PostgreSQL", "version": "16", "purpose": "数据持久化"}
            ],
            "tradeoffs": [
                {
                    "decision": "采用同步 RESTful API 而非消息队列",
                    "alternatives": ["Kafka 事件驱动"],
                    "reason": "当前业务场景对一致性要求高于吞吐量"
                }
            ],
            "risks": [
                {
                    "risk": "数据库迁移期间可能数据不一致",
                    "probability": "中",
                    "mitigation": "双写方案 + 数据校验脚本"
                }
            ]
        },
    },
    "api_doc": {
        "keywords": ["api", "接口", "接口文档"],
        "name": "api-doc-output",
        "description": "API 文档输出格式",
        "schema_def": {
            "type": "object",
            "required": ["title", "version", "base_url", "endpoints"],
            "properties": {
                "title": {"type": "string", "description": "API 文档标题"},
                "version": {"type": "string", "description": "API 版本"},
                "base_url": {"type": "string", "description": "基础 URL"},
                "description": {"type": "string", "description": "API 概述"},
                "endpoints": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "path": {"type": "string"},
                            "method": {"type": "string", "enum": ["GET", "POST", "PUT", "PATCH", "DELETE"]},
                            "summary": {"type": "string"},
                            "description": {"type": "string"},
                            "parameters": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "name": {"type": "string"},
                                        "in": {"type": "string", "enum": ["query", "path", "header", "body"]},
                                        "required": {"type": "boolean"},
                                        "type": {"type": "string"},
                                        "description": {"type": "string"}
                                    }
                                }
                            },
                            "responses": {
                                "type": "object",
                                "additionalProperties": {
                                    "type": "object",
                                    "properties": {
                                        "description": {"type": "string"},
                                        "schema": {"type": "object"}
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        "example": {
            "title": "User Service API",
            "version": "v1",
            "base_url": "https://api.example.com/v1",
            "description": "用户管理服务 API 接口文档",
            "endpoints": [
                {
                    "path": "/users",
                    "method": "GET",
                    "summary": "获取用户列表",
                    "description": "分页查询用户列表，支持按姓名和状态筛选",
                    "parameters": [
                        {"name": "page", "in": "query", "required": False, "type": "integer", "description": "页码"},
                        {"name": "size", "in": "query", "required": False, "type": "integer", "description": "每页条数"}
                    ],
                    "responses": {
                        "200": {"description": "成功", "schema": {"type": "object"}},
                        "401": {"description": "未认证"}
                    }
                }
            ]
        },
    },
    "database": {
        "keywords": ["数据库", "database", "表结构", "数据模型"],
        "name": "database-schema-output",
        "description": "数据库表结构输出格式",
        "schema_def": {
            "type": "object",
            "required": ["database", "version", "tables"],
            "properties": {
                "database": {"type": "string", "description": "数据库名称"},
                "version": {"type": "string", "description": "版本号"},
                "engine": {"type": "string", "enum": ["PostgreSQL", "MySQL", "SQLite", "MongoDB"]},
                "tables": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "description": {"type": "string"},
                            "columns": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "name": {"type": "string"},
                                        "type": {"type": "string"},
                                        "nullable": {"type": "boolean"},
                                        "default": {"type": "string"},
                                        "description": {"type": "string"},
                                        "is_primary_key": {"type": "boolean"},
                                        "is_foreign_key": {"type": "boolean"},
                                        "references": {"type": "string", "description": "外键引用"}
                                    }
                                }
                            },
                            "indexes": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "name": {"type": "string"},
                                        "columns": {
                                            "type": "array",
                                            "items": {"type": "string"}
                                        },
                                        "unique": {"type": "boolean"},
                                        "type": {"type": "string", "enum": ["BTREE", "HASH", "GIN", "GIST"]}
                                    }
                                }
                            }
                        }
                    }
                },
                "relationships": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "from_table": {"type": "string"},
                            "from_column": {"type": "string"},
                            "to_table": {"type": "string"},
                            "to_column": {"type": "string"},
                            "type": {"type": "string", "enum": ["one_to_one", "one_to_many", "many_to_many"]}
                        }
                    }
                }
            }
        },
        "example": {
            "database": "user_service_db",
            "version": "v1",
            "engine": "PostgreSQL",
            "tables": [
                {
                    "name": "users",
                    "description": "用户表",
                    "columns": [
                        {
                            "name": "id", "type": "UUID", "nullable": False,
                            "is_primary_key": True, "description": "用户ID"
                        },
                        {
                            "name": "email", "type": "VARCHAR(255)",
                            "nullable": False, "description": "邮箱"
                        },
                        {
                            "name": "created_at", "type": "TIMESTAMP",
                            "nullable": False, "default": "NOW()", "description": "创建时间"
                        },
                    ],
                    "indexes": [
                        {"name": "idx_users_email", "columns": ["email"], "unique": True, "type": "BTREE"}
                    ]
                }
            ],
            "relationships": [
                {
                    "from_table": "orders", "from_column": "user_id",
                    "to_table": "users", "to_column": "id", "type": "many_to_one"
                }
            ]
        },
    },
    "deployment": {
        "keywords": ["部署", "deploy", "发布", "上线"],
        "name": "deployment-plan-output",
        "description": "部署方案输出格式",
        "schema_def": {
            "type": "object",
            "required": ["project", "version", "environment", "steps"],
            "properties": {
                "project": {"type": "string", "description": "项目名称"},
                "version": {"type": "string", "description": "部署版本"},
                "environment": {"type": "string", "enum": ["开发", "测试", "预发布", "生产"]},
                "datetime": {"type": "string", "format": "date-time"},
                "operator": {"type": "string", "description": "操作人"},
                "steps": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "order": {"type": "integer"},
                            "name": {"type": "string"},
                            "type": {"type": "string", "enum": ["pre_check", "deploy", "post_check", "rollback"]},
                            "command": {"type": "string"},
                            "timeout_seconds": {"type": "integer"},
                            "expected_result": {"type": "string"},
                            "status": {"type": "string", "enum": ["待执行", "执行中", "成功", "失败", "已跳过"]},
                            "output": {"type": "string"},
                            "duration_seconds": {"type": "number"}
                        }
                    }
                },
                "summary": {
                    "type": "object",
                    "properties": {
                        "start_time": {"type": "string", "format": "date-time"},
                        "end_time": {"type": "string", "format": "date-time"},
                        "total_duration_seconds": {"type": "number"},
                        "result": {"type": "string", "enum": ["成功", "失败", "部分成功"]},
                        "notes": {"type": "string"}
                    }
                }
            }
        },
        "example": {
            "project": "user-service",
            "version": "v2.1.0",
            "environment": "生产",
            "datetime": "2025-01-15T22:00:00",
            "operator": "运维团队",
            "steps": [
                {
                    "order": 1,
                    "name": "数据库备份",
                    "type": "pre_check",
                    "command": "pg_dump -Fc user_service_db > backup.dump",
                    "timeout_seconds": 300,
                    "expected_result": "备份文件生成成功",
                    "status": "成功",
                    "output": "备份完成，大小 1.2GB",
                    "duration_seconds": 45.3
                },
                {
                    "order": 2,
                    "name": "灰度发布",
                    "type": "deploy",
                    "command": "kubectl set image deployment/user-api user-api=v2.1.0 --record",
                    "timeout_seconds": 600,
                    "expected_result": "10% 流量切换至新版本",
                    "status": "成功",
                    "output": "灰度发布成功，健康检查通过",
                    "duration_seconds": 120.5
                }
            ],
            "summary": {
                "start_time": "2025-01-15T22:00:00",
                "end_time": "2025-01-15T22:15:30",
                "total_duration_seconds": 930,
                "result": "成功",
                "notes": "所有步骤执行成功，服务运行正常"
            }
        },
    },
    "custom": {
        "keywords": [],
        "name": "custom-output",
        "description": "自定义输出格式",
        "schema_def": {
            "type": "object",
            "required": ["id", "title", "content"],
            "properties": {
                "id": {"type": "string", "description": "唯一标识"},
                "title": {"type": "string", "description": "标题"},
                "description": {"type": "string", "description": "描述信息"},
                "content": {"type": "object", "description": "核心内容"},
                "metadata": {
                    "type": "object",
                    "properties": {
                        "created_at": {"type": "string", "format": "date-time"},
                        "updated_at": {"type": "string", "format": "date-time"},
                        "tags": {
                            "type": "array",
                            "items": {"type": "string"}
                        },
                        "status": {"type": "string", "enum": ["草稿", "进行中", "已完成", "已归档"]}
                    }
                }
            }
        },
        "example": {
            "id": "doc-001",
            "title": "示例标题",
            "content": {},
            "metadata": {
                "created_at": "2025-01-15T10:00:00",
                "updated_at": "2025-01-15T10:00:00",
                "tags": ["示例"],
                "status": "草稿"
            }
        },
    },
}


class SchemaGenerator(BaseGenerator):
    """自然语言描述 → JSON Schema 定义."""

    def generate(self, request: GenerateRequest) -> GenerateResponse:
        schema_id = f"schema_{hashlib.md5(request.description.encode()).hexdigest()[:8]}"  # nosec
        template = self._match_template(request.description)

        if template:
            schema_def = template["schema_def"]
            example = template["example"]
            if template is SCHEMA_TEMPLATES["custom"]:
                example = {**example, "description": request.description}
            content = json.dumps(schema_def, ensure_ascii=False, indent=2)
            return GenerateResponse(
                id=schema_id,
                name=template["name"],
                description=template["description"],
                content=content,
                metadata={
                    "type": "application/vnd.schema+json",
                    "format_type": "json",
                    "schema_def": schema_def,
                    "example": json.dumps(example, ensure_ascii=False, indent=2),
                },
            )

        template = SCHEMA_TEMPLATES["custom"]
        schema_def = template["schema_def"]
        example = {**template["example"], "description": request.description}
        content = json.dumps(schema_def, ensure_ascii=False, indent=2)
        return GenerateResponse(
            id=schema_id,
            name=template["name"],
            description=f"自定义输出格式: {request.description}",
            content=content,
            metadata={
                "type": "application/vnd.schema+json",
                "format_type": "json",
                "schema_def": schema_def,
                "example": json.dumps(example, ensure_ascii=False, indent=2),
            },
        )

    def supported_keywords(self) -> list[str]:
        return [kw for t in SCHEMA_TEMPLATES.values() if t["keywords"] for kw in t["keywords"]]

    def _match_template(self, description: str) -> dict | None:
        desc_lower = description.lower()
        for key, template in SCHEMA_TEMPLATES.items():
            if key == "custom":
                continue
            if any(kw in desc_lower for kw in template["keywords"]):
                return template
        return None
