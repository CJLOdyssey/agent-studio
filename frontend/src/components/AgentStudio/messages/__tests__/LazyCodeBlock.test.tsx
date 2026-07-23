import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LazyCodeBlock from '../LazyCodeBlock';

describe('LazyCodeBlock', () => {
  it('renders fallback code element while loading', () => {
    render(<LazyCodeBlock t={(k) => k}>test code</LazyCodeBlock>);
    expect(screen.getByText('test code')).toBeDefined();
  });
});
