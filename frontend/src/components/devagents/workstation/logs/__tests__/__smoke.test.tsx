import { describe, it, expect } from 'vitest';

describe('LogAudit', () => {
  it('module exports the component', async () => {
    const mod = await import('../index');
    expect(mod.LogAudit).toBeDefined();
  });
});
