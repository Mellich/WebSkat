// What a client may see. Other players' hands never appear here (docs/02-architecture.md §3,
// docs/04-game-engine.md Part B4). Built only by view.ts / viewGame.ts.

import type {
  BiddingStage,
  CardId,
  Declaration,
  GamePhase,
  GameResult,
  Legal,
  Role,
  Suit,
} from '../engine';
import type { BotLevel, PlayerId, TableStatus } from './types';

export interface PlayerPublic {
  readonly id: PlayerId;
  readonly name: string;
  readonly connected: boolean;
  readonly isBot: boolean;
  readonly seat: number | null; // null while pending
}

export interface ViewTrick {
  readonly leaderId: PlayerId;
  readonly plays: readonly { readonly playerId: PlayerId; readonly card: CardId }[];
}

export interface ViewLastTrick extends ViewTrick {
  readonly winnerId: PlayerId;
}

export interface SpitzenInfo {
  readonly with: boolean;
  readonly count: number;
}

/** Spitzen of the declarer's 12 cards for every trump option (shown while declaring). */
export interface DeclarerSpitzen {
  readonly grand: SpitzenInfo;
  readonly suit: Readonly<Record<Suit, SpitzenInfo>>;
}

export type ViewResult =
  | { readonly kind: 'passed-in' }
  | (Omit<Extract<GameResult, { kind: 'played' }>, 'declarer'> & {
      readonly declarerId: PlayerId;
    });

export interface ViewBidEvent {
  readonly playerId: PlayerId;
  readonly type: 'bid' | 'hold' | 'pass' | 'claim';
  readonly value?: number | undefined;
}

export interface GameView {
  readonly number: number;
  readonly phase: GamePhase;
  readonly dealerId: PlayerId;
  readonly roles: Readonly<Record<Role, PlayerId>>;
  readonly sittingOut: readonly PlayerId[];
  readonly turnId: PlayerId | null;
  readonly waitingFor: PlayerId | null; // turnId when that player is disconnected
  readonly bidding: {
    readonly stage: BiddingStage;
    readonly callerId: PlayerId;
    readonly listenerId: PlayerId;
    readonly currentBid: number | null;
    readonly history: readonly ViewBidEvent[];
  };
  readonly declarerId: PlayerId | null;
  readonly bid: number | null;
  readonly pickedUpSkat: boolean;
  readonly declaration: Declaration | null;
  readonly myHand: readonly CardId[];
  readonly openHands: Readonly<Record<PlayerId, readonly CardId[]>>; // ouvert declarer only
  readonly handCounts: Readonly<Record<PlayerId, number>>;
  readonly skat: readonly CardId[] | null; // declarer while discarding/declaring; everybody when finished
  readonly discarded: readonly CardId[] | null; // everybody when finished
  readonly trick: ViewTrick;
  readonly lastTrick: ViewLastTrick | null;
  readonly tricksWon: Readonly<Record<PlayerId, number>>;
  readonly legal: Legal;
  readonly result: ViewResult | null;
  readonly declarerSpitzen: DeclarerSpitzen | null; // declarer only, while declaring
}

export interface TableView {
  readonly seq: number;
  readonly table: {
    readonly key: string;
    readonly name: string;
    readonly hostId: PlayerId;
    readonly maxSeats: number;
    readonly botLevel: BotLevel;
    readonly status: TableStatus;
    readonly players: readonly PlayerPublic[];
    readonly pending: readonly PlayerPublic[];
    readonly nextDealerId: PlayerId | null;
    readonly readyIds: readonly PlayerId[];
  };
  readonly you: {
    readonly id: PlayerId;
    readonly seat: number | null;
    readonly role: Role | 'sitting-out' | 'pending' | 'lobby';
  };
  readonly game: GameView | null;
}
