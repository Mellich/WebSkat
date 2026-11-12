// The content of the phase panel for each game phase (docs/ui-game-screen.md §3), or null while
// the cards are played. Every button comes from `game.legal`; the UI never decides legality.

import type { ReactNode } from 'react';
import type { CardId, Declaration, GameAction } from '../../engine';
import type { GameView } from '../../table';
import type { Translator } from '../i18n';
import { BiddingPanel } from './BiddingPanel';
import { DeclarationPicker } from './DeclarationPicker';
import { DoublingPanel } from './DoublingPanel';
import { DiscardPanel, SkatDecision } from './SkatPanels';

export interface PhasePanelInput {
  readonly game: GameView;
  readonly myTurn: boolean;
  /** The viewer is the declarer and chooses the two cards to discard. */
  readonly isDiscarding: boolean;
  readonly discardPick: readonly CardId[];
  readonly onDiscard: (cards: readonly [CardId, CardId]) => void;
  /** The declarer's name, or '' before the bidding is won. */
  readonly declarer: string;
  readonly nameOf: (id: string) => string;
  readonly send: (action: GameAction) => void;
  readonly t: Translator;
}

export function phasePanelContent({ game, myTurn, isDiscarding, discardPick, onDiscard, declarer, nameOf, send, t }: PhasePanelInput): ReactNode {
  switch (game.phase) {
    case 'bidding':
      return <BiddingPanel bidding={game.bidding} legal={game.legal} nameOf={nameOf} send={send} />;
    case 'skat-decision':
      return <SkatDecision legal={game.legal} isMine={myTurn} declarerName={declarer} send={send} />;
    case 'discarding':
      return isDiscarding ? (
        <DiscardPanel
          selected={discardPick.length}
          onDiscard={() => {
            const [a, b] = discardPick;
            if (a !== undefined && b !== undefined) onDiscard([a, b]);
          }}
        />
      ) : <p>{t('status.waitingFor', { name: declarer })}</p>;
    case 'declaring':
      return myTurn && game.legal.declarations !== undefined ? (
        <DeclarationPicker
          options={game.legal.declarations}
          spitzen={game.declarerSpitzen}
          bid={game.bid}
          onDeclare={(d: Declaration) => {
            send({ type: 'declare', declaration: d });
          }}
        />
      ) : <p>{t('declare.waiting', { name: declarer })}</p>;
    case 'doubling':
      return (
        <DoublingPanel
          legal={game.legal}
          isMine={myTurn}
          waitingFor={game.turnId === null ? '' : nameOf(game.turnId)}
          send={send}
        />
      );
    case 'playing':
    case 'finished':
      return null;
    default: {
      const unused: never = game.phase;
      return unused;
    }
  }
}
