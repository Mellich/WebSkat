// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Switch } from './Switch';
import { SegmentedControl } from './SegmentedControl';

afterEach(() => {
  cleanup();
});

describe('Switch', () => {
  it('is a checkbox named by its label and reports the new state', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} testId="rule-x">Ramsch</Switch>);
    const box = screen.getByRole<HTMLInputElement>('checkbox', { name: 'Ramsch' });
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not report changes when disabled', () => {
    render(<Switch checked disabled onChange={() => undefined}>Locked</Switch>);
    expect(screen.getByRole<HTMLInputElement>('checkbox', { name: 'Locked' }).disabled).toBe(true);
  });
});

describe('SegmentedControl', () => {
  const options = [
    { value: 'seeger' as const, label: 'Seeger' },
    { value: 'standard' as const, label: 'Standard' },
  ];

  it('checks the chosen option and reports the picked value', () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Scoring" options={options} value="seeger" onChange={onChange} />);
    expect(screen.getByRole<HTMLInputElement>('radio', { name: 'Seeger' }).checked).toBe(true);
    fireEvent.click(screen.getByRole('radio', { name: 'Standard' }));
    expect(onChange).toHaveBeenCalledWith('standard');
  });
});
