// zod schemas for cards, declarations, game actions and table commands (docs/networking.md §3).
// Typed against the engine/table types, so drift between schema and type is a compile error.

import { z } from 'zod';
import { BID_VALUES, isCardId, type CardId, type Declaration, type GameAction } from '../engine';
import type { TableCommand } from '../table';

export const CardIdSchema = z.custom<CardId>((v) => typeof v === 'string' && isCardId(v), {
  message: 'unknown card id',
});

const SuitSchema = z.enum(['C', 'S', 'H', 'D']);
const AnnounceSchema = z.enum(['none', 'schneider', 'schwarz']);

export const DeclarationSchema: z.ZodType<Declaration> = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('suit'),
    trump: SuitSchema,
    hand: z.boolean(),
    announce: AnnounceSchema,
    ouvert: z.boolean(),
  }),
  z.object({
    kind: z.literal('grand'),
    hand: z.boolean(),
    announce: AnnounceSchema,
    ouvert: z.boolean(),
  }),
  z.object({ kind: z.literal('null'), hand: z.boolean(), ouvert: z.boolean() }),
]);

const BidValueSchema = z.custom<number>(
  (v) => typeof v === 'number' && BID_VALUES.includes(v),
  { message: 'not a bid value' },
);

export const GameActionSchema: z.ZodType<GameAction> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('bid'), value: BidValueSchema }),
  z.object({ type: z.literal('hold') }),
  z.object({ type: z.literal('pass') }),
  z.object({ type: z.literal('claim') }),
  z.object({ type: z.literal('pickup-skat') }),
  z.object({ type: z.literal('play-hand') }),
  z.object({ type: z.literal('discard'), cards: z.tuple([CardIdSchema, CardIdSchema]) }),
  z.object({ type: z.literal('declare'), declaration: DeclarationSchema }),
  z.object({ type: z.literal('kontra') }),
  z.object({ type: z.literal('re') }),
  z.object({ type: z.literal('no-double') }),
  z.object({ type: z.literal('play'), card: CardIdSchema }),
]);

export const TableCommandSchema: z.ZodType<TableCommand> = z.discriminatedUnion('type', [
  z.object({ type: z.literal('start') }),
  z.object({ type: z.literal('game'), action: GameActionSchema }),
  z.object({ type: z.literal('ready') }),
  z.object({ type: z.literal('abort-game') }),
  z.object({ type: z.literal('kick'), playerId: z.string().min(1).max(64) }),
  z.object({
    type: z.literal('replace-player'),
    playerId: z.string().min(1).max(64),
    by: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('pending'), playerId: z.string().min(1).max(64) }),
      z.object({ kind: z.literal('bot'), level: z.enum(['easy', 'normal', 'strong']) }),
    ]),
  }),
  z.object({ type: z.literal('add-bot') }),
  z.object({ type: z.literal('set-bot-level'), playerId: z.string().min(1).max(64), level: z.enum(['easy', 'normal', 'strong']) }),
  z.object({ type: z.literal('leave') }),
  z.object({ type: z.literal('set-game-limit'), limit: z.number().int().min(0).max(999) }),
  z.object({ type: z.literal('add-rounds') }),
  z.object({ type: z.literal('set-rules'), rules: z.object({ ramsch: z.boolean(), bock: z.boolean(), kontra: z.boolean() }) }),
]);
