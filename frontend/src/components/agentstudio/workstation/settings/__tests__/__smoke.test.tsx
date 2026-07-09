import { describe, it, expect } from 'vitest';

describe('SystemSettings', () => {
  it('module exports the component', async () => {
    const mod = await import('../index');
    expect(mod.SystemSettings).toBeDefined();
  });
});
