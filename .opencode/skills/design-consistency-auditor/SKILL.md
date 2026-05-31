---
name: design-consistency-auditor
description: Audits UI code for design consistency, brand compliance, and visual cohesion. Use when reviewing frontend code for alignment with design systems, brand guidelines, and consistent visual language.
---
# Design Consistency Auditor

Reviews UI implementations for design consistency, brand compliance, and visual cohesion.

## Audit Checklist

### Visual Consistency
- Color palette matches design tokens (no hardcoded colors)
- Typography scale is consistent (font sizes, weights, line heights)
- Spacing follows the established grid/scale system
- Border radii, shadows use design token values
- Icon style and sizing are uniform

### Component Consistency
- Similar patterns use the same components
- States (hover, active, disabled, focus) are handled consistently
- Form elements share consistent styling
- Button variants follow established patterns

### Responsive Consistency
- Breakpoint behavior is consistent across similar components
- Layout shifts at same breakpoints
- Mobile/desktop adaptations follow established patterns

## Process

1. Identify the design system or style guide being used
2. Scan codebase for visual inconsistencies
3. Check component usage across pages
4. Verify responsive behavior patterns
5. Report findings with specific file locations and suggestions

## Output Format

For each issue found, provide:
- **Severity**: critical/high/medium/low
- **Location**: file:line
- **Issue**: what's inconsistent
- **Expected**: what should be used instead
- **Suggestion**: how to fix it
