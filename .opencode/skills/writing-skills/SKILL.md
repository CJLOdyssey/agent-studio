---
name: writing-skills
description: Use when creating new SKILL.md files for OpenCode skills. Covers skill structure, frontmatter, writing effective descriptions, and testing skills.
---
# Writing Skills

Creates effective OpenCode skills.

## SKILL.md Structure
```yaml
---
name: skill-name
description: Clear trigger description (1-1024 chars)
---
# Instructions for the agent
```

## Guidelines
- **Name**: lowercase with hyphens, 1-64 chars, matches directory name
- **Description**: Be specific about when the skill should trigger
- **Instructions**: Clear, direct, step-by-step
- Start with "Use when..." in the description
- Include concrete examples
- Reference supporting files if needed

## Testing Your Skill
1. Place in `.opencode/skills/<name>/SKILL.md`
2. Restart OpenCode
3. Test with a matching prompt
4. Iterate on description if it doesn't trigger
