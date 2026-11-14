// zod schema of the analysis link data (AGENTS.md hard rule 4: validate external data).

import { z } from 'zod';
import { CardIdSchema, DeclarationSchema, DoubleLevelSchema } from '../../net';
import type { AnalysisInput } from '../../table';

const role = z.enum(['forehand', 'middlehand', 'hindhand']);

const byRole = <T extends z.ZodType>(value: T) => z.object({
  forehand: value,
  middlehand: value,
  hindhand: value,
});

const BidSchema = z.object({
  role,
  type: z.enum(['bid', 'hold', 'pass', 'claim']),
  value: z.number().int().optional(),
});

export const AnalysisInputSchema: z.ZodType<AnalysisInput> = z.object({
  version: z.literal(1),
  kind: z.enum(['played', 'ramsch', 'passed-in']),
  names: byRole(z.string().max(40)),
  hands: byRole(z.array(CardIdSchema).length(10)),
  skat: z.array(CardIdSchema).length(2),
  declarer: role.nullable(),
  declaration: DeclarationSchema.nullable(),
  bid: z.number().int().nullable(),
  pickedUpSkat: z.boolean(),
  discarded: z.array(CardIdSchema).max(2),
  doubling: DoubleLevelSchema,
  bidding: z.array(BidSchema).max(200),
  plays: z.array(CardIdSchema).max(30),
});
