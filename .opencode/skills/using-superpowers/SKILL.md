---
name: using-superpowers
description: Use when understanding how the skill system itself works, discovering available skills, or learning how to invoke and compose skills effectively.
---
# Using Superpowers: The Skill System

This skill describes how to use the skill system itself.

## How Skills Work
- Skills are loaded on-demand via `skill(name="...")`
- Each skill has a `name` and `description` in its frontmatter
- The description determines when OpenCode automatically triggers the skill
- You can manually invoke any skill by name

## Skill Loading Priority
1. Project skills: `.opencode/skills/<name>/SKILL.md`
2. User skills: `~/.config/opencode/skills/<name>/SKILL.md`
3. Built-in skills: OpenCode's bundled skills

## Tips
- Use `skill(name="skill-name")` to load a skill manually
- Multiple skills can be loaded together
- Skills compose — their instructions merge
- Keep skill descriptions specific to avoid false triggers
