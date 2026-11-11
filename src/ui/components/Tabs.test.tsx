// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tabs } from './Tabs';

afterEach(() => {
  cleanup();
});

const items = [
  { id: 'a' as const, label: 'Alpha' },
  { id: 'b' as const, label: 'Beta' },
  { id: 'c' as const, label: 'Gamma' },
];

describe('Tabs', () => {
  it('marks the value as selected and only that tab is in the tab order', () => {
    render(<Tabs label="Pages" items={items} value="b" onChange={() => undefined} />);
    expect(screen.getByRole('tab', { name: 'Beta' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Beta' }).tabIndex).toBe(0);
    expect(screen.getByRole('tab', { name: 'Alpha' }).tabIndex).toBe(-1);
  });

  it('switches on click and moves with the arrow keys, wrapping around', () => {
    const onChange = vi.fn();
    render(<Tabs label="Pages" items={items} value="a" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Beta' }));
    expect(onChange).toHaveBeenLastCalledWith('b');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Alpha' }), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('c');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Alpha' }), { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('c');
  });
});
