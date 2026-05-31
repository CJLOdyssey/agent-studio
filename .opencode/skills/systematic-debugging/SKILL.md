---
name: systematic-debugging
description: Use when debugging complex issues in code. Covers hypothesis-driven debugging, root cause analysis, and verification of fixes.
---
# Systematic Debugging

Debug issues using a structured, hypothesis-driven approach.

## Process
1. **Reproduce**: Get reliable reproduction steps
2. **Isolate**: Narrow down to minimal test case
3. **Hypothesize**: Form specific hypothesis about root cause
4. **Test**: Validate or invalidate hypothesis
5. **Fix**: Implement targeted fix
6. **Verify**: Confirm fix resolves original issue
7. **Learn**: Add regression test

## Debugging Tools
- Read error messages completely
- Add targeted logging
- Use debugger/breakpoints
- Check recent changes with git bisect
- Write minimal reproduction script

## Golden Rule
Change one thing at a time. Test after each change.
