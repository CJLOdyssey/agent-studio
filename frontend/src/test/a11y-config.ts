import { axe } from 'vitest-axe';
import type { RunOptions, Result } from 'axe-core';

export const wcag21AAConfig: RunOptions = {
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
  },
  rules: {
    'color-contrast': { enabled: true },
    'html-has-lang': { enabled: true },
    'html-lang-valid': { enabled: true },
    'label': { enabled: true },
    'button-name': { enabled: true },
    'image-alt': { enabled: true },
    'link-name': { enabled: true },
    'list': { enabled: true },
    'listitem': { enabled: true },
    'aria-allowed-attr': { enabled: true },
    'aria-required-attr': { enabled: true },
    'aria-roles': { enabled: true },
    'aria-valid-attr-value': { enabled: true },
    'aria-valid-attr': { enabled: true },
    'heading-order': { enabled: true },
    'duplicate-id': { enabled: true },
    'duplicate-id-active': { enabled: true },
    'duplicate-id-aria': { enabled: true },
    'empty-heading': { enabled: true },
    'form-field-multiple-labels': { enabled: true },
    'frame-title': { enabled: true },
    'input-button-name': { enabled: true },
    'landmark-one-main': { enabled: false },
    'page-has-heading-one': { enabled: false },
    'region': { enabled: false },
  },
};

export async function runA11yCheck(
  container: HTMLElement,
  options: RunOptions = wcag21AAConfig,
): Promise<Result[]> {
  const results = await axe(container, options);
  return results.violations;
}
