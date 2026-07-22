import { describe, it, expect } from 'vitest';

describe('MonitorCenter', () => {
  it('module exports the component', async () => {
    const mod = await import('../index');
    expect(mod.MonitorCenter).toBeDefined();
  });
});
