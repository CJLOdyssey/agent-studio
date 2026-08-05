# Fix 11: Celery 双执行路径统一（RUN_DISPATCH 开关）Implementation Plan

> **For agentic workers:** 独立方案，在独立 worktree/分支执行（`git worktree add ../agent-studio-p11 main -b fix/p11-celery`）。只修改本文件列出的文件。**禁碰 `backend/src/routers/sessions.py` 与 `backend/src/services/text_utils.py`（P10 独占）。**

**Goal:** agent/team/complete 管线执行方式由 env 显式控制——dev 默认进程内（thread），生产走 Celery worker，消灭「worker 空闲 + 双路径漂移」。
**Architecture:** 新增 `RUN_DISPATCH=thread|celery`（默认 thread）；celery 模式经 `.delay()` 走 worker（`run_agent`/新增 `run_team`/`complete_agent`），thread 模式保持 `asyncio.create_task`；compose.prod 设 `RUN_DISPATCH=celery`。
**Tech Stack:** Python 3.12 / Celery / asyncio

## 并行协调

- 独占文件：`backend/src/services/run_service.py`、`backend/src/tasks/registry.py`、`docker/compose.local.yml`、`docker/compose.prod.yml`、`backend/tests/services/test_run_service.py`
- 与 P10 文件边界互补（P10 禁碰 run_service.py，本方案禁碰 sessions.py）
- **契约（N1 引擎增强）**：本方案新增的 `run_team` Celery 任务调用 `tasks/team_pipeline._run_team_pipeline`。**该函数当前签名**（已核验）：`_run_team_pipeline(requirement, run_id, session_id, team_id, key_id=None, model="", api_key="", api_base=None)`——**无 `user_id` 参数**（team 管线不做 key 用量计费）。N1 保持此签名不变；**本方案的 `run_team` 不传 `user_id`**（`run_agent` 因 `_run_agent_pipeline` 有 `user_id` 参数才传）。**本方案不修改 team_pipeline.py，N1 不修改 registry.py。**

## Global Constraints

- 默认行为不变（thread），dev/测试不受影响
- 单文件 ≤400 行（run_service.py 现 327 行，注意控制增量）
- TDD：先写 dispatch 测试
- 提交遵循 .gitmessage 格式

---

## 根因

`run_service.py:158-178` 用 `asyncio.create_task` 进程内直跑管线，而 `tasks/registry.py:22-112` 定义了 Celery 任务（`run_agent`/`complete_agent`）却无任何 `.delay()` 调用点；Docker 编排中独立 celery worker 实际空闲。两套路径共享管线函数，行为漂移风险；且 celery 任务不透传 `user_id`（`_run_agent_pipeline` 需要），team 管线根本没有 celery 任务。

## Files

- Modify: `backend/src/services/run_service.py`
- Modify: `backend/src/tasks/registry.py`（加 `run_team` 任务 + `user_id` 透传）
- Modify: `docker/compose.prod.yml`（backend 设 `RUN_DISPATCH=celery`）
- Modify: `backend/tests/services/test_run_service.py`

> 注：`docker/compose.local.yml` 无需改动（默认 thread，dev 行为不变），仅在确有需要时补注释。

---

- [ ] **Step 1: registry.py 增加 `run_team` 任务并为 `run_agent` 透传 `user_id`**

```python
@_task(bind=True, max_retries=2, default_retry_delay=5)
def run_agent(
    self: Any,
    requirement: str,
    run_id: str | None = None,
    session_id: str | None = None,
    agent_id: str | None = None,
    api_key: str | None = None,
    api_base: str | None = None,
    model: str | None = None,
    user_id: str = "system",
) -> Any:
    ...
        result = _run_async(
            _run_agent_pipeline(
                requirement,
                run_id,
                session_id,
                agent_id,
                api_key=api_key,
                api_base=api_base,
                model=model,
                user_id=user_id,
            )
        )
```

新增 `run_team` 任务（紧随 `run_agent` 之后）：

```python
@_task(bind=True, max_retries=2, default_retry_delay=5)
def run_team(
    self: Any,
    requirement: str,
    run_id: str,
    session_id: str | None = None,
    team_id: str | None = None,
    key_id: str | None = None,
    api_key: str | None = None,
    api_base: str | None = None,
    model: str | None = None,
) -> Any:
    from .team_pipeline import _run_team_pipeline

    logger.info("Celery team task START | run=%s | team=%s", run_id, team_id)
    try:
        return _run_async(
            _run_team_pipeline(
                requirement=requirement,
                run_id=run_id,
                session_id=session_id,
                team_id=team_id,
                key_id=key_id,
                api_key=api_key,
                api_base=api_base,
                model=model,
            )
        )
    except Exception as exc:
        logger.exception("Celery team task FAIL | run=%s", run_id)
        _report_run_error(run_id, exc)
        self.retry(exc=exc)
```

- [ ] **Step 2: run_service.py 增加分派开关**

文件顶部加：

```python
import os

# "thread"（默认，进程内 asyncio.create_task，适合 dev） | "celery"（走 worker）
RUN_DISPATCH = os.environ.get("RUN_DISPATCH", "thread")
```

`create_run` 的分派段（原 L149-197）改为：

```python
        # ── Dispatch pipeline ───────────────────────────────────────
        try:
            if RUN_DISPATCH == "celery":
                from tasks import registry as _reg

                if team_id:
                    from repository.workflows import get_workflow_config_by_team

                    workflow = await get_workflow_config_by_team(team_id)
                    if workflow:
                        _reg.run_team.delay(
                            requirement=requirement, run_id=run_id, session_id=session_id,
                            team_id=team_id, key_id=key_id, api_key=api_key,
                            api_base=api_base, model=effective_model,
                        )
                        logger.info("Team task -> celery | run=%s | team=%s", run_id, team_id)
                        return {"run_id": run_id, "status": "pending", "session_id": session_id}
                _reg.run_agent.delay(
                    requirement=requirement, run_id=run_id, session_id=session_id,
                    agent_id=agent_id, api_key=api_key, api_base=api_base,
                    model=effective_model, user_id=user_id,
                )
                logger.info("Task -> celery | run=%s", run_id)
                return {"run_id": run_id, "status": "pending", "session_id": session_id}

            # thread 模式：进程内后台任务
            if team_id:
                from repository.workflows import get_workflow_config_by_team

                workflow = await get_workflow_config_by_team(team_id)
                if workflow:
                    from tasks.team_pipeline import _run_team_pipeline

                    asyncio.create_task(
                        _run_team_pipeline(
                            requirement=requirement, run_id=run_id, session_id=session_id,
                            team_id=team_id, key_id=key_id, api_key=api_key,
                            api_base=api_base, model=effective_model, user_id=user_id,
                        )
                    )
                    logger.info("Team task started (thread) | run=%s | team=%s | nodes=%d",
                                run_id, team_id, len(workflow.nodes))
                    return {"run_id": run_id, "status": "pending", "session_id": session_id}

            from tasks import _run_agent_pipeline

            asyncio.create_task(
                _run_agent_pipeline(
                    requirement=requirement, run_id=run_id, session_id=session_id,
                    agent_id=agent_id, api_key=api_key, api_base=api_base,
                    model=effective_model, user_id=user_id,
                )
            )
            logger.info("Task started (thread) | run_id=%s | session_id=%s | model=%s",
                        run_id, session_id, effective_model)
        except Exception:
            logger.exception("Failed to start agent task for run=%s", run_id)
            await update_run_status(run_id, "error")
            raise

        return {"run_id": run_id, "status": "pending", "session_id": session_id}
```

`continue_run` 的分派段（原 L252-269）改为：

```python
        if RUN_DISPATCH == "celery":
            from tasks import registry as _reg

            _reg.complete_agent.delay(
                content=content, run_id=run_id, api_key=api_key,
                api_base=api_base, model=effective_model, thinking=thinking,
            )
            logger.info("Complete -> celery | run=%s", run_id)
            return {"run_id": run_id, "status": "running", "session_id": session_id}

        async def _run_pipeline() -> Any:
            try:
                from tasks import _complete_pipeline

                await _complete_pipeline(
                    content=content, run_id=run_id, api_key=api_key,
                    api_base=api_base, model=effective_model, thinking=thinking,
                )
            except Exception:
                logger.exception("Complete pipeline failed for run=%s", run_id)
                await update_run_status(run_id, "error")

        asyncio.create_task(_run_pipeline())
```

- [ ] **Step 3: compose.prod.yml backend 服务加 env**

```yaml
    environment:
      RUN_DISPATCH: celery
```

（compose.local.yml 不加，默认 thread 保持 dev 行为。）

- [ ] **Step 4: 测试 test_run_service.py（先写失败测试）**

```python
def test_create_run_dispatches_to_celery_when_enabled(monkeypatch):
    from services import run_service as rs

    monkeypatch.setenv("RUN_DISPATCH", "celery")
    rs.RUN_DISPATCH = "celery"

    captured: dict = {}
    from tasks import registry as _reg

    monkeypatch.setattr(_reg, "run_agent", type("Fake", (), {"delay": lambda **kw: captured.update(kw) or None})())

    # 复用现有 create_run 测试的 DB/key fixture（按 test_run_service.py 既有约定 mock）
    ...


def test_create_run_uses_thread_when_default(monkeypatch):
    # RUN_DISPATCH 缺省为 "thread" → 断言走 asyncio.create_task（mock 之）
    ...
```

（Step 4 的完整断言复用既有 `test_run_service.py` 的 fixture 模式：mock `create_session`/`get_api_key_*`/`buffer_run_messages` 后调用 `create_run`，断言 `captured["agent_id"]` 正确且未触发 `asyncio.create_task`；thread 模式断言 create_task 被调用。）

- [ ] **Step 5: 验证**

```bash
pytest backend/tests/services/test_run_service.py -v   # 新增 2 测试 + 既有全绿
ruff check backend/src/services/run_service.py backend/src/tasks/registry.py
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/run_service.py backend/src/tasks/registry.py \
        docker/compose.local.yml docker/compose.prod.yml backend/tests/services/test_run_service.py
git commit -m "refactor(tasks): env-driven dispatch (thread|celery) for agent/team/complete pipelines"
```

## Self-Review

- 默认 `RUN_DISPATCH=thread`，dev/既有测试行为完全不变
- celery 模式补齐了缺失的 `run_team` 任务与 `user_id` 透传，worker 真正可执行
- compose.local 不改（celery worker 服务仍在，dev 不需要）；compose.prod 显式启用 celery
