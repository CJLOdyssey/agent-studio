# CI/CD Skills

4 技能覆盖完整 CI/CD 生命周期：

```
设计 ──→ 修复 ──→ 安全 ──→ 验证
 ①        ②        ③        ④
```

| # | Skill | 位置 | 来源 | ⭐ | 职责 |
|---|-------|------|------|-----|------|
| ① | `ci-cd-and-automation` | `~/.agents/skills/` | 本地 | — | Pipeline 搭建、质量门禁、部署策略、缓存/并行优化 |
| ② | `gh-fix-ci` | `~/.codex/skills/` | openai/skills | 23,990 | CI 失败诊断、错误定位、自动修复提交 |
| ③ | `security-best-practices` | `~/.codex/skills/` | openai/skills | 23,990 | 密钥管理、依赖审计、SAST/DAST、最小权限 |
| ④ | `verification-loop` | `~/.agents/skills/` | 本地 | — | 全链路测试验证、失败反馈闭环、回归检测 |

## 使用方式

```bash
# 设计 Pipeline → 详见 ci-cd-and-automation.md
skill ci-cd-and-automation

# 修复 CI 失败 → 详见 gh-fix-ci.md
skill gh-fix-ci

# 安全审查 → 详见 security-best-practices.md
skill security-best-practices

# 验证闭环 → 详见 verification-loop.md
skill verification-loop
```
