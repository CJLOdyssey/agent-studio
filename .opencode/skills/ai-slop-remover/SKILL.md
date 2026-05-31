---
name: ai-slop-remover
description: Detects and removes AI-generated code smells and tells from code. Use when cleaning up AI-written code to remove excessive comments, unnecessary abstractions, and other AI coding patterns.
---
# AI Slop Remover

Removes common AI-generated code patterns that detract from code quality.

## What to Look For

### Excessive Commenting
- Comments explaining obvious code
- "Here's how the function works" on self-documenting code
- Step-by-step comments on simple operations
- Redundant doc comments on private/internal functions

### Over-Engineering
- Unnecessary abstractions "for future flexibility"
- Overuse of design patterns on simple problems
- Factory factories and abstraction layers
- Premature optimization that adds complexity

### Verbosity
- Overly defensive null checks
- Verbose variable names (verboseUserInputProcessor)
- Redundant type annotations where inferred
- Unnecessary intermediate variables

### Generic Patterns
- Boilerplate error handling without actual error strategy
- "TODO: handle" without context
- Generic logging at every function entry/exit
- Unnecessary try-catch blocks

## Process
1. Scan changed/new files for AI slop patterns
2. Remove unnecessary comments
3. Simplify over-engineered code
4. Consolidate verbose patterns
5. Ensure behavior is preserved after cleanup
