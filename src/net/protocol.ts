// Wire messages (docs/05-networking.md §3). Every incoming message is parsed with these schemas
// before it is used; anything else is dropped.

import { z } from 'zod';
import type { GameRecord, TableCommand, TableView } from '../table';
import { PROTOCOL_VERSION } from './constants';
import { isValidKey } from './keys';
import { GameRecordSchema, TableViewSchema } from './schemaView';
import { TableCommandSchema } from './schemaGame';

const version = z.literal(PROTOCOL_VERSION);
const hexToken = z.string().regex(/^[0-9a-f]{32}$/);

export const JoinSchema = z.object({
  t: z.literal('join'),
  v: z.number().int(),
  name: z.string().min(1).max(40),
  token: hexToken.optional(),
});

export const CmdSchema = z.object({
  t: z.literal('cmd'),
  command: TableCommandSchema,
});

/** Messages a client sends to the host (channel `cmd`). */
export const ClientMessageSchema = z.discriminatedUnion('t', [JoinSchema, CmdSchema]);

export const WelcomeSchema = z.object({
  t: z.literal('welcome'),
  v: version,
  playerId: z.string().min(1).max(64),
  token: hexToken,
});

export const RecordsSchema = z.object({
  t: z.literal('records'),
  records: z.array(GameRecordSchema),
});

export const RecordSchema = z.object({
  t: z.literal('record'),
  record: GameRecordSchema,
});

export const ViewSchema = z.object({
  t: z.literal('view'),
  view: TableViewSchema,
});

export const ErrorSchema = z.object({
  t: z.literal('error'),
  code: z.string().min(1).max(40),
  message: z.string().max(300),
  ref: z.string().max(64).optional(),
});

export const RejectedSchema = z.object({
  t: z.literal('rejected'),
  reason: z.enum(['TABLE_FULL', 'PROTOCOL_MISMATCH', 'BAD_NAME']),
});

/** Messages the host sends to a client (channel `msg`). */
export const HostMessageSchema = z.discriminatedUnion('t', [
  WelcomeSchema,
  ViewSchema,
  RecordsSchema,
  RecordSchema,
  ErrorSchema,
  RejectedSchema,
  z.object({ t: z.literal('kicked') }),
  z.object({ t: z.literal('closed') }),
]);

/** A table advertisement on the lobby room (channel `ad`). */
export const AdSchema = z.object({
  t: z.literal('ad'),
  v: version,
  key: z.string().refine(isValidKey, { message: 'invalid table key' }),
  name: z.string().min(1).max(40),
  hostName: z.string().min(1).max(40),
  seats: z.number().int().min(0).max(6),
  maxSeats: z.number().int().min(3).max(6),
  status: z.enum(['lobby', 'in-game']),
  ts: z.number(),
});

export type JoinMessage = z.infer<typeof JoinSchema>;
export type ClientMessage = z.infer<typeof ClientMessageSchema>;
export type HostMessage = z.infer<typeof HostMessageSchema>;
export type AdMessage = z.infer<typeof AdSchema>;

export function cmdMessage(command: TableCommand): ClientMessage {
  return { t: 'cmd', command };
}

export function viewMessage(view: TableView): HostMessage {
  return { t: 'view', view };
}

export function recordMessage(record: GameRecord): HostMessage {
  return { t: 'record', record };
}

export { TableViewSchema, GameRecordSchema };
