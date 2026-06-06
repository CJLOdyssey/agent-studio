# 06.2 技能文档生成

## 业务闭环

```
用户描述需求 → LLM 生成 YAML 技能文档 → 验证格式 → 保存到 skills/ → Agent 可加载
```

## 核心文件

`virtual_team/routers/skills.py`

## 技能格式

```yaml
# skills/{name}.yaml
name: skill_name
description: 技能描述
version: "1.0"
triggers:
  - "关键词1"
  - "关键词2"
instructions: |
  详细指令...
examples:
  - input: "示例输入"
    output: "示例输出"
```

## 生成流程

```python
# skills.py 中的实现
async def generate_skill(request: GenerateRequest, ...) -> SkillMeta:
    # 1. 构建 Prompt
    prompt = SKILL_GENERATION_PROMPT.format(description=request.description)
    
    # 2. 调用 LLM 生成 YAML
    yaml_content = await llm.generate(prompt)
    
    # 3. 验证 YAML 格式
    skill_data = yaml.safe_load(yaml_content)
    validate_skill_schema(skill_data)
    
    # 4. 保存到 skills/ 目录
    file_path = SKILLS_DIR / f"{name}.yaml"
    file_path.write_text(yaml_content)
    
    # 5. 返回技能元数据
    return SkillMeta(name=name, description=description, ...)
```
