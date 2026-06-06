# 10.2 技能生成 Agent

## 业务闭环

```
用户描述技能需求 → skill_agent 分析 → 生成 YAML 文档 → 验证格式 → 保存到 skills/ → 主 Agent 可加载
```

## 核心文件

`system_team/agents/skill_agent.yaml`

## Agent 定义

```yaml
name: skill_agent
description: 技能生成专家，根据用户描述生成结构化的技能文档
system_prompt: |
  你是一个专业的技能生成专家。你的任务是：
  1. 理解用户对技能的需求
  2. 生成符合项目规范的 YAML 技能文档
  3. 确保文档包含触发条件和详细指令
  
  技能格式要求：
  - 必须包含 name, description, version 字段
  - 必须包含 triggers 列表（触发关键词）
  - 必须包含 instructions 详细指令
  - 可选包含 examples 示例
tools:
  - file_operations
```

## 技能格式

```yaml
# 生成的技能示例
name: code_review
description: 代码审查技能，检查代码质量和最佳实践
version: "1.0"
triggers:
  - "审查"
  - "review"
  - "检查代码"
  - "code review"
instructions: |
  执行代码审查时：
  1. 检查代码风格一致性
  2. 检查潜在的 bug 和逻辑错误
  3. 检查性能问题
  4. 检查安全漏洞
  5. 提供改进建议
examples:
  - input: "审查这段代码"
    output: |
      ## 审查结果
      - ✅ 代码风格一致
      - ⚠️ 第 5 行可能有空指针
      - 💡 建议使用常量替代魔法数字
```

## 生成流程

```
用户: "帮我生成一个代码审查技能"
    │
    ▼
skill_agent 接收需求
    │
    ▼
LLM 生成 YAML 文档
    │
    ▼
验证 YAML 格式 + Schema
    │
    ├── 通过 → 保存到 skills/code_review.yaml
    └── 失败 → 重新生成
    │
    ▼
返回结果: "技能 code_review 已生成"
```
