// The declarer line of the status area: who won the bidding and how far the round has got (pure).

import type { GameView } from '../../table';
import type { Translator } from '../i18n';
import { declarationLabel } from './labels';

export function declarerSummary(game: GameView, nameOf: (id: string) => string, t: Translator): string | null {
  if (game.declarerId === null || game.phase === 'bidding') return null;
  const name = nameOf(game.declarerId);
  const bid = game.bid ?? '';
  const won = t('summary.won', { name, bid });
  switch (game.phase) {
    case 'skat-decision':
      return won;
    case 'discarding':
      return `${won} · ${t('summary.skatTaken')}`;
    case 'declaring':
      return `${won} · ${game.pickedUpSkat ? t('summary.skatTaken') : t('summary.hand')}`;
    case 'playing':
    case 'finished': {
      if (game.declaration === null) return null;
      const playing = t('summary.playing', { game: declarationLabel(game.declaration, t), name, bid });
      return game.pickedUpSkat ? `${playing} · ${t('summary.skatTaken')}` : playing;
    }
    default: {
      const unused: never = game.phase;
      return unused;
    }
  }
}
