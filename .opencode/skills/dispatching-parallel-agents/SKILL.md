---
name: dispatching-parallel-agents
description: Use when needing to dispatch multiple agents in parallel for concurrent work on independent tasks. Covers parallel agent orchestration, result aggregation, and error handling.
---
# Dispatching Parallel Agents

Orchestrates multiple agents working concurrently on independent sub-tasks.

## When to Use
- Multiple independent files need changes
- Research tasks can run in parallel
- Different domains need simultaneous investigation

## Process
1. Break work into independent units
2. Dispatch each unit to a separate agent
3. Collect results as they complete
4. Handle partial failures gracefully
5. Merge outputs coherently

## Best Practice
Keep parallelism to 3-5 concurrent agents. Too many degrade quality. Always have a merge step.
