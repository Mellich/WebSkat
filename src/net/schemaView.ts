// zod schemas for views and game records sent from the host (docs/05-networking.md §3).

import { z } from 'zod';
import type { GameRecord, GameView, TableView, ViewResult } from '../table';
import { CardIdSchema, DeclarationSchema } from './schemaGame';

const id = z.string().min(1).max(64);
const nullableId = id.nullable();
const cards = z.array(CardIdSchema);
const playerIds = z.array(id);
const countsById = z.record(id, z.number().int().min(0));
const cardsById = z.record(id, cards);
const seatRole = z.enum(['forehand', 'middlehand', 'hindhand']);
const roles = z.object({ forehand: id, middlehand: id, hindhand: id });
const spitzen = z.object({ with: z.boolean(), count: z.number().int().min(0) });


const PlayerPublicSchema = z.object({
  id,
  name: z.string().min(1).max(40),
  connected: z.boolean(),
  isBot: z.boolean(),
  botLevel: z.enum(['easy', 'normal', 'strong']).nullable(),
  seat: z.number().int().min(0).nullable(),
});

const TrickSchema = z.object({
  leaderId: id,
  plays: z.array(z.object({ playerId: id, card: CardIdSchema })),
});

const LegalSchema = z.object({
  bidValues: z.array(z.number().int()).optional(),
  canPassBid: z.boolean().optional(),
  canHold: z.boolean().optional(),
  canClaim: z.boolean().optional(),
  canPickUp: z.boolean().optional(),
  canPlayHand: z.boolean().optional(),
  discardFrom: cards.optional(),
  declarations: z.array(DeclarationSchema).optional(),
  playableCards: cards.optional(),
});

const ViewResultSchema: z.ZodType<ViewResult> = z.union([
  z.object({ kind: z.literal('passed-in') }),
  z.object({
    kind: z.literal('played'),
    declarerId: id,
    bid: z.number().int(),
    declaration: DeclarationSchema,
    spitzen: spitzen.nullable(),
    declarerPoints: z.number().int(),
    defenderPoints: z.number().int(),
    declarerTricks: z.number().int(),
    defenderTricks: z.number().int(),
    schneider: z.boolean(),
    schwarz: z.boolean(),
    base: z.number().int(),
    multiplier: z.number().int().nullable(),
    gameValue: z.number().int(),
    playedWon: z.boolean(),
    overbid: z.boolean(),
    won: z.boolean(),
    loseValue: z.number().int().nullable(),
    declarerScore: z.number().int(),
  }),
]);

const GameViewSchema: z.ZodType<GameView> = z.object({
  number: z.number().int().min(1),
  phase: z.enum(['bidding', 'skat-decision', 'discarding', 'declaring', 'playing', 'finished']),
  dealerId: id,
  roles,
  sittingOut: playerIds,
  turnId: nullableId,
  waitingFor: nullableId,
  bidding: z.object({
    stage: z.union([z.literal(1), z.literal(2), z.literal('claim'), z.literal('done'), z.literal('passed-in')]),
    callerId: id,
    listenerId: id,
    currentBid: z.number().int().nullable(),
    history: z.array(
      z.object({
        playerId: id,
        type: z.enum(['bid', 'hold', 'pass', 'claim']),
        value: z.number().int().optional(),
      }),
    ),
  }),
  declarerId: nullableId,
  bid: z.number().int().nullable(),
  pickedUpSkat: z.boolean(),
  declaration: DeclarationSchema.nullable(),
  myHand: cards,
  openHands: cardsById,
  handCounts: countsById,
  skat: cards.nullable(),
  discarded: cards.nullable(),
  trick: TrickSchema,
  lastTrick: TrickSchema.extend({ winnerId: id }).nullable(),
  tricksWon: countsById,
  legal: LegalSchema,
  result: ViewResultSchema.nullable(),
  declarerSpitzen: z
    .object({
      grand: spitzen,
      suit: z.object({ C: spitzen, S: spitzen, H: spitzen, D: spitzen }),
    })
    .nullable(),
});

export const TableViewSchema: z.ZodType<TableView> = z.object({
  seq: z.number().int().min(0),
  table: z.object({
    key: z.string().min(1).max(16),
    name: z.string().min(1).max(40),
    hostId: id,
    maxSeats: z.number().int().min(3).max(6),
    status: z.enum(['lobby', 'in-game']),
    players: z.array(PlayerPublicSchema),
    pending: z.array(PlayerPublicSchema),
    nextDealerId: nullableId,
    readyIds: playerIds,
  }),
  you: z.object({
    id,
    seat: z.number().int().min(0).nullable(),
    role: z.union([seatRole, z.enum(['sitting-out', 'pending', 'lobby'])]),
  }),
  game: GameViewSchema.nullable(),
});

const ScoresSchema = z.object({
  standard: z.record(id, z.number()),
  seeger: z.record(id, z.number()),
});

export const GameRecordSchema: z.ZodType<GameRecord> = z.object({
  id: z.string().min(1).max(80),
  number: z.number().int().min(1),
  timestamp: z.number(),
  tableSize: z.number().int().min(3).max(6),
  dealerId: id,
  roles,
  sittingOut: playerIds,
  names: z.record(id, z.string()),
  outcome: z.enum(['passed-in', 'played']),
  declarerId: nullableId,
  bid: z.number().int().nullable(),
  game: z.enum(['clubs', 'spades', 'hearts', 'diamonds', 'grand', 'null']).nullable(),
  hand: z.boolean(),
  ouvert: z.boolean(),
  announce: z.enum(['none', 'schneider', 'schwarz']),
  spitzenWith: z.boolean().nullable(),
  spitzenCount: z.number().int().nullable(),
  multiplier: z.number().int().nullable(),
  gameValue: z.number().int().nullable(),
  declarerPoints: z.number().int().nullable(),
  defenderPoints: z.number().int().nullable(),
  declarerTricks: z.number().int().nullable(),
  schneider: z.boolean(),
  schwarz: z.boolean(),
  overbid: z.boolean(),
  won: z.boolean(),
  scores: ScoresSchema,
});

