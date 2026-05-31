---
name: import-checker
description: Checks import health, detects circular dependencies, unused imports, barrel file issues, and import structure problems. Use when reviewing code for import hygiene and dependency organization.
---
# Import Checker

Analyzes import statements for health issues, circular dependencies, and optimization opportunities.

## Checks Performed

### Critical Issues
- **Circular Dependencies**: Detect A → B → A import cycles
- **Missing Imports**: References to non-existent exports
- **Unused Imports**: Imported but never referenced

### Code Quality
- **Barrel File Bloat**: Re-exporting everything from index files
- **Wildcard Imports**: `import * from 'x'` — prevents tree-shaking
- **Deep Imports**: Prefer direct paths over deep traversal
- **Duplicate Imports**: Same module imported multiple times

### Performance
- **Side-effect imports**: `import 'x'` — ensure intentional
- **Dynamic import opportunities**: Heavy modules that could be lazy-loaded
- **Bundle size**: Large dependencies that should be split

## Process

1. Scan import statements across changed/new files
2. Check for circular dependencies using dependency graph
3. Identify unused and duplicate imports
4. Flag barrel file issues
5. Suggest optimizations for build performance
