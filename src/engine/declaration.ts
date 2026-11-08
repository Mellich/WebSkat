import { SUITS } from './cards';
import { err, ok, type Announce, type Declaration, type Result } from './types';

const ANNOUNCES: readonly Announce[] = ['none', 'schneider', 'schwarz'];

/** Validity matrix of skat-rules §5.1. `hand` = the Skat was not picked up. */
export function validateDeclaration(
  d: Declaration,
  hand: boolean,
): Result<Declaration, 'INVALID_DECLARATION'> {
  if (d.hand !== hand) {
    return err('INVALID_DECLARATION', 'The declaration does not match the way the game was played.');
  }
  if (d.kind === 'null') {
    return ok(d);
  }
  if (!d.hand) {
    return d.announce === 'none' && !d.ouvert
      ? ok(d)
      : err('INVALID_DECLARATION', 'Without Hand, no announcement and no Ouvert are allowed.');
  }
  if (d.ouvert && d.announce !== 'schwarz') {
    return err('INVALID_DECLARATION', 'Hand with Ouvert requires announcing Schwarz.');
  }
  return ok(d);
}

/** All valid declarations for a game: 7 without Hand, 22 with Hand. */
export function declarationOptions(hand: boolean): Declaration[] {
  const candidates: Declaration[] = [];
  for (const ouvert of [false, true]) {
    for (const announce of ANNOUNCES) {
      for (const trump of SUITS) {
        candidates.push({ kind: 'suit', trump, hand, announce, ouvert });
      }
      candidates.push({ kind: 'grand', hand, announce, ouvert });
    }
    candidates.push({ kind: 'null', hand, ouvert });
  }
  return candidates.filter((d) => validateDeclaration(d, hand).ok);
}
