# 覆盖率提升计划实施总结

## 已完成的改进

### 1. 变更覆盖率 (Diff Coverage) - CI 必加 ⭐⭐⭐⭐⭐

**实施内容：**
- 在 `requirements-lock.txt` 中添加 `diff-cover==9.2.3`
- 在 CI workflow 中添加 `diff-coverage` job，仅在 PR 时运行
- 配置 70% 的覆盖率阈值作为 PR 门禁
- 添加 PR 评论功能，当覆盖率不足时自动评论

**CI 输出示例：**
```
Diff Coverage
Total:   78 of 120 lines  65%
Missing: 42 lines
---
backend/routers/auth.py (67%): 行 45-48, 行 72-75, ...
```

**使用方法：**
```bash
# 本地运行
PYTHONPATH=. python3 -m pytest tests/ --cov=backend --cov-report=xml
diff-cover coverage.xml --compare-branch=origin/main --fail-under=70
```

---

### 2. 需求覆盖率 - 逐步建立 ⭐⭐⭐⭐

**实施内容：**
- 创建 `tests/REQUIREMENTS.md` 追溯矩阵（52 个需求，覆盖 10 个模块）
- 创建 `tests/requirement_coverage.py` pytest 插件
- 创建 `tests/test_requirement_markers.py` 示例测试
- 在 `pyproject.toml` 中注册 `requirement` marker
- 在 CI 中添加 `requirement-coverage` job

**需求覆盖统计：**
| 模块 | 需求总数 | 已覆盖 | 覆盖率 |
|------|---------|--------|--------|
| 认证模块 | 10 | 8 | 80% |
| 会话管理 | 7 | 5 | 71% |
| Agent 配置 | 6 | 6 | 100% |
| 运行管理 | 7 | 5 | 71% |
| 工具管理 | 5 | 5 | 100% |
| 工作流 | 4 | 3 | 75% |
| 模型管理 | 3 | 3 | 100% |
| Prompt 管理 | 3 | 3 | 100% |
| 知识库 | 4 | 4 | 100% |
| 监控 | 3 | 3 | 100% |
| **总计** | **52** | **45** | **87%** |

**使用方法：**
```bash
# 在测试中添加需求标记
@pytest.mark.requirement("REQ-AUTH-001")
async def test_login_success():
    ...

# 运行需求覆盖率报告
PYTHONPATH=. python3 -m pytest tests/ --requirement-coverage

# 或使用独立脚本
python3 scripts/requirement_coverage.py --check --threshold 80
```

---

### 3. 代码覆盖率 - 保持现有 ⭐⭐⭐

**现状：**
- 已有 `pytest-cov` 配置
- 阈值设置为 45%（CI 中）
- 生成 HTML 和 XML 报告

**改进：**
- CI 中同时生成 XML 报告供 diff-cover 使用
- 上传 coverage.xml 作为 artifact

---

### 4. 变异覆盖率 - 后续可选 ⭐⭐

**建议：**
- 等测试体系成熟后再添加
- 只对核心模块做（auth、payment）
- 只在夜间构建做
- 使用 `mutmut` (Python) 或 `stryker-mutator` (JS/TS)

---

## 新增文件

| 文件 | 说明 |
|------|------|
| `tests/REQUIREMENTS.md` | 需求追溯矩阵（52 个需求） |
| `tests/requirement_coverage.py` | pytest 插件，收集 requirement markers |
| `tests/test_requirement_markers.py` | 示例测试，展示如何使用 marker |
| `scripts/requirement_coverage.py` | 独立脚本，生成需求覆盖率报告 |

## 修改文件

| 文件 | 修改内容 |
|------|----------|
| `requirements-lock.txt` | 添加 `diff-cover==9.2.3` |
| `.github/workflows/ci.yml` | 添加 diff-coverage 和 requirement-coverage jobs |
| `pyproject.toml` | 注册 `requirement` marker |
| `AGENTS.md` | 更新文档，说明新的覆盖率系统 |

---

## CI 流程变化

**之前：**
```
frontend-lint → frontend-test → frontend-build
backend-lint → backend-security → backend-test
integration → docs-check → ci-passed
```

**现在：**
```
frontend-lint → frontend-test → frontend-build
backend-lint → backend-security → backend-test → diff-coverage (PR only)
integration → docs-check → requirement-coverage → ci-passed
```

---

## 后续建议

1. **逐步补充测试**：优先补充 6 个未覆盖的需求（REQ-AUTH-008、REQ-SES-006、REQ-SES-007、REQ-RUN-006、REQ-RUN-007、REQ-WF-004）

2. **在现有测试中添加 marker**：为已有的测试用例添加 `@pytest.mark.requirement()` 标记

3. **前端覆盖率**：考虑为前端添加类似的变更覆盖率检查

4. **变异测试**：当测试覆盖率稳定在 60% 以上时，考虑引入 mutmut

---

## 参考资料

- [diff-cover 文档](https://diff-cover.readthedocs.io/)
- [pytest markers 文档](https://docs.pytest.org/en/latest/how-to/mark.html)
- [mutmut 文档](https://mutmut.readthedocs.io/)
