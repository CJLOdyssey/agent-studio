import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FileNodeComponent from '../FileNodeComponent';

describe('FileNodeComponent', () => {
  it('renders a file node', () => {
    const node = { id: '1', name: 'file.ts', type: 'file' as const };
    render(<FileNodeComponent node={node} depth={0} />);
    expect(screen.getByText('file.ts')).toBeInTheDocument();
  });

  it('renders a folder node', () => {
    const node = { id: '2', name: 'src', type: 'folder' as const };
    render(<FileNodeComponent node={node} depth={0} />);
    expect(screen.getByText('src')).toBeInTheDocument();
  });

  it('toggles folder expansion on click', () => {
    const children = [
      { id: '3', name: 'index.ts', type: 'file' as const },
    ];
    const node = { id: '2', name: 'src', type: 'folder' as const, children };
    render(<FileNodeComponent node={node} depth={0} />);
    expect(screen.getByText('index.ts')).toBeInTheDocument();
    fireEvent.click(screen.getByText('src'));
    expect(screen.queryByText('index.ts')).not.toBeInTheDocument();
  });
});
