import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WstaDropdownPortal from '../WstaDropdownPortal';

describe('WstaDropdownPortal', () => {
  const createAnchor = () => {
    const el = document.createElement('button');
    document.body.appendChild(el);
    return el;
  };

  const items = [
    { label: 'Edit', onClick: vi.fn() },
    { divider: true as const },
    { label: 'Delete', onClick: vi.fn(), danger: true },
  ];

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    const anchorEl = createAnchor();
    render(
      <WstaDropdownPortal open={false} anchorEl={anchorEl} items={items} onClose={vi.fn()} />,
    );
    expect(screen.queryByText('Edit')).toBeNull();
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('renders nothing when anchorEl is null', () => {
    render(
      <WstaDropdownPortal open={true} anchorEl={null} items={items} onClose={vi.fn()} />,
    );
    expect(screen.queryByText('Edit')).toBeNull();
    expect(screen.queryByText('Delete')).toBeNull();
  });

  it('renders menu items when open', () => {
    const anchorEl = createAnchor();
    render(
      <WstaDropdownPortal open={true} anchorEl={anchorEl} items={items} onClose={vi.fn()} />,
    );
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('renders divider between items', () => {
    const anchorEl = createAnchor();
    render(
      <WstaDropdownPortal open={true} anchorEl={anchorEl} items={items} onClose={vi.fn()} />,
    );
    expect(document.querySelector('.wsta-dropdown-divider')).toBeInTheDocument();
  });

  it('applies danger class to danger items', () => {
    const anchorEl = createAnchor();
    render(
      <WstaDropdownPortal open={true} anchorEl={anchorEl} items={items} onClose={vi.fn()} />,
    );
    const buttons = screen.getAllByRole('menuitem');
    expect(buttons[buttons.length - 1]).toHaveClass('wsta-dropdown-danger');
  });

  it('calls item onClick and onClose when item clicked', () => {
    const anchorEl = createAnchor();
    const onClose = vi.fn();
    render(
      <WstaDropdownPortal open={true} anchorEl={anchorEl} items={items} onClose={onClose} />,
    );
    fireEvent.click(screen.getByText('Edit'));
    expect(items[0].onClick).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on outside click', () => {
    const anchorEl = createAnchor();
    const onClose = vi.fn();
    render(
      <WstaDropdownPortal open={true} anchorEl={anchorEl} items={items} onClose={onClose} />,
    );
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on menu click', () => {
    const anchorEl = createAnchor();
    const onClose = vi.fn();
    render(
      <WstaDropdownPortal open={true} anchorEl={anchorEl} items={items} onClose={onClose} />,
    );
    const menu = screen.getByRole('menu');
    fireEvent.mouseDown(menu);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Escape key', () => {
    const anchorEl = createAnchor();
    const onClose = vi.fn();
    render(
      <WstaDropdownPortal open={true} anchorEl={anchorEl} items={items} onClose={onClose} />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
