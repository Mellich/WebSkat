import { describe, expect, it } from 'vitest';
import { translate, type Translator } from '../i18n';
import { passedInInput, playedInput, ramschInput } from './analysisFixtures';
import { summaryText } from './analysisSummary';

const t: Translator = (key, params) => translate('en', key, params);

describe('summaryText', () => {
  it('names the declarer, the game and the bid of a played game', () => {
    const input = playedInput();
    const declarer = input.declarer;
    if (declarer === null || input.bid === null) throw new Error('expected a played game');
    const text = summaryText(input, t);
    expect(text.startsWith(`${input.names[declarer]} plays `)).toBe(true);
    expect(text.endsWith(` · bid ${String(input.bid)}`)).toBe(true);
  });

  it('says Ramsch for a Ramsch game', () => {
    expect(summaryText(ramschInput(), t)).toBe('Ramsch');
  });

  it('says that everybody passed', () => {
    expect(summaryText(passedInInput(), t)).toBe('Everybody passed – nothing was played.');
  });
});
