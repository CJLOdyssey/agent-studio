---
name: test-driven-development
description: Use when implementing features using Test-Driven Development methodology. Covers red-green-refactor cycle, test design, and incremental implementation.
---
# Test-Driven Development (TDD)

Implements features using the TDD cycle.

## Process
### Red Phase
1. Understand the requirement
2. Write a test that defines the expected behavior
3. Run the test — it should fail (red)

### Green Phase
4. Write minimal code to make the test pass
5. Don't optimize yet — just pass the test
6. Run the test — it should pass (green)

### Refactor Phase
7. Clean up the implementation
8. Remove duplication
9. Improve design while keeping tests green

## Principles
- Write tests first, code second
- Test one behavior at a time
- Use descriptive test names (behavior, not implementation)
- Keep tests independent and fast
- Refactor with confidence (tests are your safety net)
