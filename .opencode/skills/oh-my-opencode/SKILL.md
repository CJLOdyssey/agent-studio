---
name: oh-my-opencode
description: Multi-agent orchestration plugin that transforms OpenCode into a full agent harness with specialized agents, background task execution, category-based model routing, and autonomous work modes. Use when installing, configuring, or operating oh-my-opencode — including agent delegation, ultrawork mode, Prometheus planning, background tasks, category-based task routing, model resolution, tmux integration, or any oh-my-opencode feature.
---

# Oh My OpenCode

Multi-agent orchestration plugin for OpenCode with specialized agents, background task execution, and autonomous work modes.

**Package**: `oh-my-opencode` (install via `bunx oh-my-opencode install`)
**Repository**: https://github.com/code-yeongyu/oh-my-opencode

## Prerequisites

- OpenCode 1.0.150+ installed
- At least one LLM provider authenticated
- Strongly recommended: Anthropic Claude Pro/Max subscription

## Two Workflow Modes

### Mode 1: Ultrawork (Quick Autonomous Work)
Include `ultrawork` or `ulw` in your prompt. The agent automatically explores codebase, researches best practices, implements features, and verifies with diagnostics.

### Mode 2: Prometheus (Precise Planned Work)
Press **Tab** → Prometheus (Planner) mode → interview process → confirm plan → `/start-work` → Atlas orchestrator distributes tasks.

## Agents

| Agent | Role | Default Model |
|-------|------|---------------|
| **Sisyphus** | Primary orchestrator | claude-opus-4-5 |
| **Hephaestus** | Autonomous deep worker | gpt-5.2-codex |
| **Oracle** | Architecture, debugging | gpt-5.2 |
| **Librarian** | Docs, OSS search | glm-4.7 |
| **Explore** | Fast codebase grep | claude-haiku-4-5 |
| **Prometheus** | Work planner | claude-opus-4-5 |
| **Atlas** | Plan orchestrator | k2p5 / claude-sonnet-4-5 |
| **Momus** | Plan reviewer | gpt-5.2 |
| **Metis** | Pre-planning consultant | claude-opus-4-5 |

## Categories

Categories route tasks to Sisyphus-Junior with domain-optimized models:

| Category | Model | Best For |
|----------|-------|----------|
| visual-engineering | gemini-3-pro | Frontend, UI/UX, design |
| ultrabrain | gpt-5.2-codex | Deep logical reasoning |
| deep | gpt-5.2-codex | Goal-oriented problem-solving |
| quick | claude-haiku-4-5 | Trivial tasks, typo fixes |
| writing | gemini-3-flash | Documentation, prose |

## Slash Commands

- `/init-deep` — Initialize hierarchical AGENTS.md knowledge base
- `/start-work` — Execute a Prometheus plan with Atlas orchestrator
- `/ralph-loop` — Start self-referential development loop
- `/ulw-loop` — Start ultrawork loop
- `/refactor` — Intelligent refactoring with LSP, AST-grep

## Built-in Skills

| Skill | Purpose |
|-------|---------|
| playwright | Browser automation via Playwright MCP |
| git-master | Atomic commits, rebase/squash, history search |
| frontend-ui-ux | Designer-turned-developer for stunning UI/UX |

## Best Practices

**Do:**
- Use `ulw` for quick autonomous tasks
- Use Prometheus + `/start-work` for complex projects
- Configure categories for your providers
- Fire explore/librarian agents in parallel with `run_in_background=true`
- Use session continuity via `session_id`

**Don't:**
- Don't use Atlas without `/start-work`
- Don't disable `todo-continuation-enforcer`
- Don't run explore/librarian synchronously
- Don't use Claude Haiku for Sisyphus

## Rules for the Agent

- Package name is `oh-my-opencode` — use `bunx` for CLI commands
- Agent invocation uses `--agent` flag or `delegate_task()` — NOT `@agent` prefix
- Never change model settings unless user explicitly requests
- Prometheus and Atlas are always paired
- Background agents should always use `run_in_background=true`
- Session IDs should be preserved and reused
