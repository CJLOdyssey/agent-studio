---
name: verification-loop
description: Structured verification loop that tests, reviews, and validates changes before considering work complete. Use to ensure quality through iterative test-and-fix cycles.
---
# Verification Loop

A structured verification process that ensures changes are thoroughly tested and validated before completion.

## Process

### Phase 1: Test Execution
1. Run existing tests for the affected area
2. Check test results and identify failures
3. Fix any test regressions

### Phase 2: Code Review
1. Review changes for correctness and edge cases
2. Check error handling paths
3. Verify security implications

### Phase 3: Manual Verification
1. Test the feature end-to-end
2. Verify edge cases and error states
3. Check performance impact

### Phase 4: Quality Gates
- [ ] All tests pass
- [ ] No regressions introduced
- [ ] Code review completed
- [ ] Edge cases handled
- [ ] Error paths tested
- [ ] Documentation updated

### Phase 5: Iteration
If any gate fails:
1. Identify the issue
2. Fix it
3. Re-run verification from Phase 1
4. Repeat until all gates pass

## Key Principle

Each fix cycle should be quick and focused. Don't try to fix everything at once — iterate rapidly through the loop until quality gates are met.
