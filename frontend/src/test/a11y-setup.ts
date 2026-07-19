import { axe, type AxeResults } from 'vitest-axe';

export async function expectNoA11yViolations(container: HTMLElement): Promise<AxeResults> {
  const results = await axe(container);
  expect(results.violations).toHaveLength(0);
  return results;
}
