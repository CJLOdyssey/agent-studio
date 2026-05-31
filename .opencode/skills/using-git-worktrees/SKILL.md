---
name: using-git-worktrees
description: Use when working with multiple Git branches simultaneously using worktrees. Covers creating, managing, and removing worktrees for parallel development.
---
# Using Git Worktrees

Manages multiple branches simultaneously with git worktrees.

## Commands
```bash
# Create a new worktree
git worktree add ../project-feature feature-branch

# List worktrees
git worktree list

# Remove a worktree
git worktree remove ../project-feature

# Prune stale worktree references
git worktree prune
```

## Best Practices
- One worktree per active branch
- Clean up worktrees after merging
- Don't work in main worktree on other branches
- Use descriptive directory names matching branch names
- Worktrees share the same repository — commits are immediate
