// zod schema for the game log entries sent in every view (docs/networking.md §3, plan 10).
// One object per event kind, so the discriminated union checks each kind's fields.

import { z } from 'zod';
import type { LogEntry } from '../table';
import { DeclarationSchema } from './schemaGame';

const id = z.string().min(1).max(64);
const name = z.string().min(1).max(40);
const int = z.number().int();
const meta = { n: int.min(1), at: z.number() };
const gameKind = z.enum(['clubs', 'spades', 'hearts', 'diamonds', 'grand', 'null']);

type PersonKind = 'reconnected' | 'disconnected' | 'left' | 'kicked';
const personEvent = <K extends PersonKind>(kind: K) =>
  z.object({ kind: z.literal(kind), playerId: id, name, ...meta });

export const LogEntrySchema: z.ZodType<LogEntry> = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('joined'), playerId: id, name, isBot: z.boolean(), pending: z.boolean(), ...meta }),
  personEvent('reconnected'),
  personEvent('disconnected'),
  personEvent('left'),
  personEvent('kicked'),
  z.object({ kind: z.literal('replaced'), playerId: id, name, byId: id, byName: name, ...meta }),
  z.object({ kind: z.literal('dealt'), number: int.min(1), dealerId: id, dealerName: name, bock: z.boolean(), ...meta }),
  z.object({
    kind: z.literal('bid'),
    playerId: id,
    name,
    action: z.enum(['bid', 'hold', 'pass', 'claim']),
    value: int.nullable(),
    ...meta,
  }),
  z.object({ kind: z.literal('skat'), playerId: id, name, pickedUp: z.boolean(), ...meta }),
  z.object({ kind: z.literal('declared'), playerId: id, name, declaration: DeclarationSchema, ...meta }),
  z.object({ kind: z.literal('doubled'), playerId: id, name, level: z.union([z.literal(2), z.literal(4)]), ...meta }),
  z.object({ kind: z.literal('ramsch'), number: int.min(1), ...meta }),
  z.object({ kind: z.literal('aborted'), number: int.min(1), ...meta }),
  z.object({ kind: z.literal('bock-started'), games: int.min(1), ...meta }),
  z.object({
    kind: z.literal('result'),
    number: int.min(1),
    outcome: z.enum(['played', 'passed-in', 'ramsch']),
    declarerId: id.nullable(),
    declarerName: name.nullable(),
    game: gameKind.nullable(),
    won: z.boolean().nullable(),
    gameValue: int.nullable(),
    declarerPoints: int.nullable(),
    defenderPoints: int.nullable(),
    loserNames: z.array(name).max(6),
    durchmarschName: name.nullable(),
    ...meta,
  }),
]);
