---
version: v1.0.0
created: 2026-06-07
updated: 2026-06-07
---

# 功能：提示词生成器

> 子域：Agent 配置管理
> 状态：⬜ 未开始 | 🔄 进行中 | ✅ 已完成

---

## 用户故事

作为团队管理员，我希望通过自然语言描述自动生成 Agent 提示词，无需手动编写完整提示词模板。

---

## 接口定义

### 生成提示词

**POST /api/prompts/generate**

请求：
```json
{
  "description": "代码审查助手，审查Python代码质量"
}
```

响应 200：
```json
{
  "id": "prompt_6324d43e",
  "name": "代码审查助手",
  "description": "执行代码审查，检查代码质量、规范性和潜在问题",
  "content": "你是一位资深的代码审查专家。请对以下代码进行全面的审查...",
  "version": "v1.0",
  "tags": ["code-review", "质量保证"]
}
```

---

## 验收标准

- [ ] 输入自然语言描述 → 生成结构化提示词
- [ ] 支持关键词匹配（审查、测试、安全、API）
- [ ] 无关描述 → 使用自定义默认模板
- [ ] 相同描述 → 相同 ID（幂等）
- [ ] 返回含 tags 分类

---

## 实现位置

| 层 | 文件 | 说明 |
|---|------|------|
| Router | `virtual_team/routers/prompts.py` | `_generate_prompt_from_description` 内联函数 |
| 测试 | `tests/unit/test_06_prompt_generator.py` | 9 个单元测试 |

---

## 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|---|---|---|---|
| v1.0.0 | 2026-06-07 | Sisyphus | 初始版本 |
