import { describe, expect, it } from 'vitest';
import { BOT_NAMES, botName } from './botNames';

describe('botName', () => {
  it('names the first bot Guguurz', () => {
    expect(botName(['Host', 'Player 1'])).toBe('Guguurz');
    expect(botName([])).toBe('Guguurz');
  });

  it('gives the next bot the next name of the pool, skipping names in use', () => {
    expect(botName(['Host', 'Guguurz'])).toBe('Blubb');
    expect(botName(['Guguurz', 'Blubb'])).toBe('Kartoffel');
  });

  it('never repeats a name that is already at the table', () => {
    const names = BOT_NAMES.slice(0, 5);
    expect(names).not.toContain(botName(names));
  });

  it('falls back to a numbered name once the pool is used up', () => {
    const all = [...BOT_NAMES];
    expect(botName(all)).toBe('Bot');
    expect(botName([...all, 'Bot'])).toBe('Bot (2)');
  });

  it('keeps every pool name within the name length limit', () => {
    for (const name of BOT_NAMES) expect(name.length).toBeLessThanOrEqual(20);
  });
});
