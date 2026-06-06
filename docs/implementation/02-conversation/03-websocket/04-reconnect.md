---
version: v1.1.0
created: 2026-06-06
updated: 2026-06-06
---

# 功能：断线重连

> 子域：实时通信
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成
> 优先级：P1
> 负责人：待分配
> 预估：待评估
> 截止：待定
> 依赖：无

---

## 用户故事

作为前端，我希望网络中断后自动重连。

---


---

## 接口定义

**[METHOD] /api/[endpoint]**

请求：
```json
{
  "field": "value"
}
```

响应 200/201：
```json
{
  "id": "uuid"
}
```

## 验收标准

- [ ] 检测连接断开
- [ ] 自动尝试重连
- [ ] 最多重试 3 次
- [ ] 重连成功后恢复订阅

---


---

## 风险点

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| 待识别 | 中 | 待定 |

---

## TDD 流程

### Step 1: 编写测试

**文件**: `tests/test_websocket.py`

```python
async def test_reconnect():
    # 模拟断线重连
    conn = await connect_websocket(run_id)
    assert conn.state == "connected"
    
    await conn.disconnect()
    assert conn.state == "disconnected"
    
    await conn.reconnect()
    assert conn.state == "connected"
```

### Step 2: 运行测试 → 失败 (RED)

### Step 3: 编写实现

**文件**: `frontend/src/websocket.ts`

```typescript
export function connectRun(runId: string, options: ConnectOptions): ConnState {
    let retryCount = 0;
    const maxRetries = 3;
    
    function connect() {
        const ws = new WebSocket(`ws://${host}/ws/runs/${runId}`);
        ws.onclose = () => {
            if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(connect, 1000 * retryCount);
            }
        };
    }
    
    connect();
}
```

### Step 4: 运行测试 → 通过 (GREEN)

### Step 5: 重构优化 (REFACTOR)

---

## 涉及文件

| 类型 | 文件 |
|---|---|
| 测试 | `tests/test_websocket.py` |
| 前端 | `frontend/src/websocket.ts` |

---

## 测试覆盖率

**目标**：该功能相关代码测试覆盖率 ≥ 80%

**测试命令**：
```bash
# 后端
pytest tests/test_*.py -v --cov=virtual_team/routers/ --cov=virtual_team/repository/

# 前端（如有）
npm run test:coverage
```

**覆盖率报告**：
- 终端输出：显示行覆盖率百分比
- HTML 报告：`frontend/coverage/`（前端）或 `htmlcov/`（后端）

**验收标准**：
- [ ] 所有测试用例通过
- [ ] 覆盖率 ≥ 80%
- [ ] 关键路径 100% 覆盖

## 进度

| 步骤 | 状态 |
|---|---|
| 编写测试 | ⬜ |
| 测试失败 (RED) | ⬜ |
| 编写实现 | ⬜ |
| 测试通过 (GREEN) | ⬜ |
| 重构 (REFACTOR) | ⬜ | - |
| Code Review | ⬜ | - |
| 部署验证 | ⬜ | - |

---

## 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|---|---|---|---|
| v1.0.0 | 2026-06-06 | Sisyphus | 初始版本 |
| v1.1.0 | 2026-06-06 | Sisyphus | 添加测试覆盖率要求 |
