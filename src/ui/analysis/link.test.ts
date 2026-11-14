import { describe, expect, it } from 'vitest';
import { analysisInputFromView, viewFor, type AnalysisInput } from '../../table';
import { finishedTable } from '../../table/analysis/testing';
import { analysisHash, analysisUrl, decodeAnalysis, encodeAnalysis } from './link';

function finishedInput(): AnalysisInput {
  const s = finishedTable('played');
  const input = analysisInputFromView(viewFor(s, 'p2'));
  if (input === null) throw new Error('expected an input');
  return input;
}

/** Base64url of arbitrary text, to build links that the app must reject. */
function base64url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return btoa(String.fromCharCode(...Array.from(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

describe('analysis link', () => {
  it('round-trips a finished game, including Unicode names', () => {
    const input = finishedInput();
    const named: AnalysisInput = {
      ...input,
      names: { ...input.names, forehand: 'Jürgen 🃏', middlehand: 'Zoë' },
    };
    expect(decodeAnalysis(encodeAnalysis(named))).toEqual(named);
  });

  it('encodes as base64url without padding', () => {
    const encoded = encodeAnalysis(finishedInput());
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    ['an empty string', ''],
    ['not base64', '%%%'],
    ['JSON that is not an analysis', base64url('{"version":2}')],
    ['text that is not JSON', base64url('not json')],
  ])('rejects %s', (_label, text) => {
    expect(decodeAnalysis(text)).toBeNull();
  });

  it('rejects a game whose cards are invalid (zod passes, the engine replay fails)', () => {
    const input = finishedInput();
    const forehandCard = input.hands.forehand[0];
    if (forehandCard === undefined) throw new Error('expected a card');
    const duplicated: AnalysisInput = { ...input, skat: [forehandCard, forehandCard] };
    expect(decodeAnalysis(base64url(JSON.stringify(duplicated)))).toBeNull();
  });

  it('builds the hash and the URL of the analysis in the current app', () => {
    const input = finishedInput();
    const encoded = encodeAnalysis(input);
    expect(analysisHash(input)).toBe(`#/analysis?g=${encoded}`);
    expect(analysisUrl(input, { origin: 'https://a.b', pathname: '/WebSkat/' })).toBe(
      `https://a.b/WebSkat/#/analysis?g=${encoded}`,
    );
  });
});
