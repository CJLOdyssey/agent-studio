# 功能测试用例 — 虚拟软件外包团队

> 测试范围：完整用户使用流程，从前端交互到后端 API 到数据库持久化
> 测试策略：模拟真实用户 3 个核心场景，每个场景拆分为独立可验证的步骤

---

## 测试用户 Persona

| 属性 | 值 |
|------|-----|
| User-ID | `test-user-001` |
| API Provider | DeepSeek (使用测试 Key: `sk-test-demo-key-000000`) |
| 首选模型 | `deepseek-chat` |
| 语言 | zh-CN |

---

## 场景 1：首次访问 — 浏览主页 & 配置 API Key

> 用户第一次打开应用，浏览主页，配置自己的 API Key

### TC-1.1 健康检查
| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | 服务已启动 |
| **步骤** | `GET /api/health` |
| **预期结果** | HTTP 200, `status: "ok"`, `database: "connected"`, `redis: "connected"` |

### TC-1.2 获取可用模型列表
| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **步骤** | `GET /api/models` |
| **预期结果** | HTTP 200, 返回非空数组，每个元素含 `id`, `label`, `provider` |

### TC-1.3 获取内置命令列表
| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **步骤** | `GET /api/commands` |
| **预期结果** | HTTP 200, 返回 7 条命令（clear/export/rename/model/agents/help/shortcuts），每条含 `id`, `name`, `description` |

### TC-1.4 查看 API Key 列表（首次为空）
| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **步骤** | `GET /api/keys` (Header: `X-User-ID: test-user-001`) |
| **预期结果** | HTTP 200, 返回空数组 `[]` |

### TC-1.5 添加 API Key
| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **步骤** | `POST /api/keys` 提交 provider/deepseek, label, api_key, base_url, models, is_default=true |
| **预期结果** | HTTP 201, 返回 `id`, `provider`, `label`, `key_masked`（格式 `sk-...000`）, `is_active: true`, `is_default: true` |
| **验证** | 明文 Key 不出现在响应中 |

### TC-1.6 验证 Key 已存储（掩码显示）
| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **步骤** | `GET /api/keys` |
| **预期结果** | 返回 1 条记录，`key_masked` 不包含原始明文 Key，`is_default: true` |

### TC-1.7 添加第二个 Key（非默认）
| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **步骤** | `POST /api/keys` 提交 provider/openai, is_default=false |
| **预期结果** | HTTP 201, 返回新的 Key，`is_default: false` |
| **验证** | `GET /api/keys` 返回 2 条记录，默认 Key 仍为第一个 |

### TC-1.8 更新 Key（设为非活跃）
| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **步骤** | `PUT /api/keys/{id}` 设置 `is_active: false` |
| **预期结果** | HTTP 200, `is_active: false` |

### TC-1.9 删除非默认 Key
| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **步骤** | `DELETE /api/keys/{第二个Key的id}` |
| **预期结果** | HTTP 200, `status: "deleted"` |
| **验证** | `GET /api/keys` 返回 1 条记录 |

### TC-1.10 获取用量统计（新用户为零）
| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **步骤** | `GET /api/keys/usage` |
| **预期结果** | `today_requests: 0`, `today_tokens: 0`, `month_requests: 0`, `month_tokens: 0` |

---

## 场景 2：提交需求 & 跟踪 Agent 执行

> 用户输入软件需求，观察 Agent 讨论，查看结果

### TC-2.1 提交需求（首次，无 session）
| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **前置条件** | 已配置默认 API Key |
| **步骤** | `POST /api/runs` 提交 `{"requirement":"写一个 Python 冒泡排序", "key_id":"{default_key_id}", "model":"deepseek-chat"}` |
| **预期结果** | HTTP 200, 返回 `run_id` (UUID), `status: "pending"` |
| **验证** | 自动创建了 session（session_id 不为空） |

### TC-2.2 查询 Run 状态
| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **步骤** | `GET /api/runs/{run_id}` |
| **预期结果** | HTTP 200, `status` 为 "pending" / "running" / "converged" 之一, `requirement` 为原始输入 |

### TC-2.3 等待 Agent 执行完成
| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **步骤** | 轮询 `GET /api/runs/{run_id}` 直到 status ∈ {"converged", "error", "max_rounds_reached"} |
| **预期结果** | 60 秒内 status 变为 "converged", `code` 字段包含 Python 代码, `approved: true` |
| **超时** | 60 秒（LLM 调用） |

### TC-2.4 验证 Run 结果完整性
| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **步骤** | 检查 `GET /api/runs/{run_id}` 的响应 |
| **预期结果** | `pm_document` 非空, `code` 包含 "冒泡" 或 "bubble" 或 "sort", `review` 非空, `approved: true`, `status: "converged"` |

### TC-2.5 同一 Session 再提交一个需求（延续对话）
| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **前置条件** | TC-2.1 的 session_id |
| **步骤** | `POST /api/runs` 提交 `{"requirement":"给代码加上单元测试", "session_id":"{已有session_id}", "key_id":"{default_key_id}"}` |
| **预期结果** | HTTP 200, 返回新的 `run_id`, 同一个 session 下现在有 2 个 run |

### TC-2.6 验证 Session 包含多个 Run
| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **步骤** | `GET /api/sessions/{session_id}` |
| **预期结果** | `runs` 数组长度 ≥ 2, 每个 run 含 `id`, `requirement`, `status` |

---

## 场景 3：会话管理 & 历史浏览

> 用户管理历史会话，重命名、查看、删除

### TC-3.1 列出所有 Session
| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **步骤** | `GET /api/sessions` |
| **预期结果** | HTTP 200, 返回数组，至少包含场景 1 创建的 session, 每个元素含 `id`, `title`, `run_count`, `created_at`, `updated_at` |

### TC-3.2 获取 Session 详情
| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **步骤** | `GET /api/sessions/{session_id}` |
| **预期结果** | HTTP 200, 含 `runs` 和 `memories` 数组, `title` 为首次需求的前 64 字符 |

### TC-3.3 重命名 Session
| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **步骤** | `PUT /api/sessions/{session_id}` 提交 `{"title":"冒泡排序项目"}` |
| **预期结果** | HTTP 200, `title: "冒泡排序项目"` |

### TC-3.4 创建新 Session
| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **步骤** | `POST /api/sessions` 提交 `{"title":"新项目"}` |
| **预期结果** | HTTP 201, 返回 `id` (UUID) |
| **验证** | `GET /api/sessions` 中能查到该 session |

### TC-3.5 删除空 Session
| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **步骤** | `DELETE /api/sessions/{空session的id}` |
| **预期结果** | HTTP 200, `status: "deleted"` |
| **验证** | `GET /api/sessions/{id}` 返回 404 |

---

## 场景 4：Agent 配置管理

> 用户管理虚拟团队的 Agent 配置

### TC-4.1 列出所有 Agent
| 项目 | 内容 |
|------|------|
| **优先级** | P0 |
| **步骤** | `GET /api/agents` |
| **预期结果** | HTTP 200, 返回 4 个默认 Agent（PM/Frontend/Backend/Tester）, 每个含 `id`, `name`, `role_identifier`, `system_prompt`, `is_active`, `is_approver` |

### TC-4.2 创建自定义 Agent
| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **步骤** | `POST /api/agents` 提交 name/role_identifier/system_prompt/order/icon |
| **预期结果** | HTTP 201, `status: "created"` |
| **验证** | `GET /api/agents` 返回 5 个 Agent |

### TC-4.3 更新 Agent 配置
| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **步骤** | `PUT /api/agents/{id}` 设置 `is_active: false` |
| **预期结果** | HTTP 200, `status: "updated"` |

### TC-4.4 切换 Agent 活跃状态
| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **步骤** | `PUT /api/agents/{id}/toggle` |
| **预期结果** | HTTP 200, `is_active` 取反 |

### TC-4.5 删除非审批者 Agent
| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **步骤** | `DELETE /api/agents/{自定义agent的id}` |
| **预期结果** | HTTP 200, `status: "deleted"` |
| **验证** | `GET /api/agents` 恢复为 4 个 |

### TC-4.6 不能删除唯一审批者
| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **步骤** | `DELETE /api/agents/{tester的id}` |
| **预期结果** | HTTP 400, 错误信息包含 "审批者" |

---

## 场景 5：错误处理 & 边界条件

> 验证系统对异常输入的处理

### TC-5.1 空需求被拒绝
| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **步骤** | `POST /api/runs` 提交 `{"requirement":""}` |
| **预期结果** | HTTP 422, 校验错误 |

### TC-5.2 超长需求被拒绝
| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **步骤** | `POST /api/runs` 提交 5000 字符的 requirement |
| **预期结果** | HTTP 422, 校验错误 |

### TC-5.3 不存在的 Run 返回 404
| 项目 | 内容 |
|------|------|
| **优先级** | P2 |
| **步骤** | `GET /api/runs/nonexistent-id` |
| **预期结果** | HTTP 404 |

### TC-5.4 不存在的 Session 返回 404
| 项目 | 内容 |
|------|------|
| **优先级** | P2 |
| **步骤** | `GET /api/sessions/nonexistent-id` |
| **预期结果** | HTTP 404 |

### TC-5.5 空 API Key 被拒绝
| 项目 | 内容 |
|------|------|
| **优先级** | P1 |
| **步骤** | `POST /api/keys` 提交 `api_key: ""` |
| **预期结果** | HTTP 422 |

### TC-5.6 重复 role_identifier 被拒绝
| 项目 | 内容 |
|------|------|
| **优先级** | P2 |
| **步骤** | `POST /api/agents` 提交已存在的 `role_identifier` |
| **预期结果** | HTTP 409 |

### TC-5.7 Rate Limit 生效
| 项目 | 内容 |
|------|------|
| **优先级** | P2 |
| **步骤** | 60 秒内向 `/api/runs` 发送 >60 个请求 |
| **预期结果** | HTTP 429, `detail: "请求过于频繁，请稍后再试"` |
