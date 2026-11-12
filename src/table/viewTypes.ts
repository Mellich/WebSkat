// What a client may see. Other players' hands never appear here (docs/hidden-information.md,
// docs/table.md §6). Built only by view.ts / viewGame.ts.

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
import type { DoubleLevel } from '../engine';
import type { LogEntry } from './log';
import type { BotLevel, PlayerId, TableRules, TableStatus } from './types';

export interface PlayerPublic {
  readonly id: PlayerId;
  readonly name: string;
  readonly connected: boolean;
  readonly isBot: boolean;
  readonly botLevel: BotLevel | null; // null for humans
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
    })
  | {
      readonly kind: 'ramsch';
      readonly points: Readonly<Record<PlayerId, number>>;
      readonly tricks: Readonly<Record<PlayerId, number>>;
      readonly skatToId: PlayerId;
      readonly loserIds: readonly PlayerId[];
      readonly jungfrau: boolean;
      readonly durchmarschId: PlayerId | null;
      readonly scores: Readonly<Record<PlayerId, number>>;
    };

export interface ViewBidEvent {
  readonly playerId: PlayerId;
  readonly type: 'bid' | 'hold' | 'pass' | 'claim';
  readonly value?: number | undefined;
}

export interface GameView {
  readonly number: number;
  readonly phase: GamePhase;
  readonly ramsch: boolean; // a Ramsch is played or was played (no declarer)
  readonly bock: boolean; // a Bock game: points count double (skat-rules §13)
  readonly doubling: DoubleLevel; // 2 after Kontra, 4 after Re (skat-rules §14)
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
  readonly initialHands: Readonly<Record<PlayerId, readonly CardId[]>> | null; // everybody when finished, else null
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
  readonly log: readonly LogEntry[]; // the newest LOG_VIEW_LIMIT entries, oldest first
  readonly table: {
    readonly key: string;
    readonly name: string;
    readonly hostId: PlayerId;
    readonly maxSeats: number;
    readonly status: TableStatus;
    readonly players: readonly PlayerPublic[];
    readonly pending: readonly PlayerPublic[];
    readonly nextDealerId: PlayerId | null;
    readonly readyIds: readonly PlayerId[];
    readonly rules: TableRules;
    readonly gameLimit: number; // games to play, 0 = unlimited
    readonly gamesPlayed: number; // finished games (records)
    readonly seriesOver: boolean; // limit reached and everyone continued: final standings
    readonly bockGamesLeft: number; // Bock games still to come, the running one included
  };
  readonly you: {
    readonly id: PlayerId;
    readonly seat: number | null;
    readonly role: Role | 'sitting-out' | 'pending' | 'lobby';
  };
  readonly game: GameView | null;
}
