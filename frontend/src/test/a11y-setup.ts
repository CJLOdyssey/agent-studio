import { axe } from 'vitest-axe';
import { expect } from 'vitest';
import type { Result } from 'axe-core';

export async function expectNoA11yViolations(container: HTMLElement): Promise<Result[]> {
  const results = await axe(container);
  expect(results.violations).toHaveLength(0);
  return results.violations;
}
