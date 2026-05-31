---
name: refactor
description: Intelligent code refactoring with LSP, AST analysis, architecture analysis, and TDD. Use when the user asks to refactor code, improve code quality, restructure architecture, or reduce technical debt.
---
# Refactor

Intelligent refactoring of code with structural awareness.

## Process
1. **Analyze**: Understand current structure and dependencies
2. **Plan**: Design target structure
3. **Refactor**: Execute changes incrementally
4. **Verify**: Ensure behavior is preserved (tests + review)

## Capabilities
- Rename/restructure symbols across files
- Extract methods, classes, modules
- Move code between files
- Improve type safety
- Reduce duplication
- Improve error handling patterns
- Update imports and references

## Safety
- Always have tests before refactoring
- Make small, verifiable changes
- Run tests after each change
- Use version control for safety net
