// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useSettings } from '../store/settings';
import { CardChip } from './CardChip';

afterEach(() => { cleanup(); });

describe('CardChip', () => {
  it('shows the compact symbol and keeps the full accessible card name', () => {
    useSettings.getState().update({ language: 'en' });
    const { container } = render(<CardChip card="H10" />);
    expect(screen.getByRole('img', { name: 'Ten of hearts' }).textContent).toBe('♥10');
    expect(container.firstElementChild?.className).toContain('red');
  });
});
