// Derives the log events of one successful command (docs/table.md §4a, plan 10). Pure: the
// table reducer calls commandLog after the command was applied and appends the result.

import { assertNever, type GameAction } from '../engine';
import { BOCK_GAMES } from './bock';
import type { LogEvent } from './log';
import { allPlayers } from './seating';
import type { GameRecord, Player, PlayerId, TableCommand, TableState } from './types';

/** Value of a `claim` ("plays at 18"). */
const CLAIM_VALUE = 18;

const findPlayer = (s: TableState, id: PlayerId): Player | undefined =>
  allPlayers(s).find((p) => p.id === id);

const nameOf = (s: TableState, id: PlayerId): string => findPlayer(s, id)?.name ?? id;

/** Players that exist after the command but not before it. */
function newcomers(before: TableState, after: TableState): Player[] {
  const known = new Set(allPlayers(before).map((p) => p.id));
  return allPlayers(after).filter((p) => !known.has(p.id));
}

function gameEvents(before: TableState, after: TableState, actor: PlayerId, action: GameAction): LogEvent[] {
  const name = nameOf(before, actor);
  switch (action.type) {
    case 'bid':
      return [{ kind: 'bid', playerId: actor, name, action: 'bid', value: action.value }];
    case 'claim':
      return [{ kind: 'bid', playerId: actor, name, action: 'claim', value: CLAIM_VALUE }];
    case 'hold':
    case 'pass':
      return [{ kind: 'bid', playerId: actor, name, action: action.type, value: null }];
    case 'pickup-skat':
      return [{ kind: 'skat', playerId: actor, name, pickedUp: true }];
    case 'play-hand':
      return [{ kind: 'skat', playerId: actor, name, pickedUp: false }];
    case 'declare': {
      const declaration = after.game?.engine.declaration ?? null;
      return declaration === null ? [] : [{ kind: 'declared', playerId: actor, name, declaration }];
    }
    case 'kontra':
      return [{ kind: 'doubled', playerId: actor, name, level: 2 }];
    case 're':
      return [{ kind: 'doubled', playerId: actor, name, level: 4 }];
    case 'no-double':
    case 'discard':
    case 'play':
      return [];
    default:
      return assertNever(action);
  }
}

type SeatCommand = Extract<TableCommand, { type: 'kick' | 'leave' | 'add-bot' | 'replace-player' | 'abort-game' }>;

function seatEvents(before: TableState, after: TableState, actor: PlayerId, c: SeatCommand): LogEvent[] {
  switch (c.type) {
    case 'kick':
      return [{ kind: 'kicked', playerId: c.playerId, name: nameOf(before, c.playerId) }];
    case 'leave':
      return [{ kind: 'left', playerId: actor, name: nameOf(before, actor) }];
    case 'add-bot':
      return newcomers(before, after).map((p) => ({
        kind: 'joined',
        playerId: p.id,
        name: p.name,
        isBot: p.isBot,
        pending: after.pending.some((x) => x.id === p.id),
      }));
    case 'replace-player': {
      const byId = c.by.kind === 'pending' ? c.by.playerId : newcomers(before, after)[0]?.id;
      if (byId === undefined) return [];
      return [{
        kind: 'replaced',
        playerId: c.playerId,
        name: nameOf(before, c.playerId),
        byId,
        byName: nameOf(after, byId),
      }];
    }
    case 'abort-game':
      return before.game === null ? [] : [{ kind: 'aborted', number: before.game.number }];
    default:
      return assertNever(c);
  }
}

function commandEvents(before: TableState, after: TableState, actor: PlayerId, c: TableCommand): LogEvent[] {
  switch (c.type) {
    case 'game':
      return gameEvents(before, after, actor, c.action);
    case 'kick':
    case 'leave':
    case 'add-bot':
    case 'replace-player':
    case 'abort-game':
      return seatEvents(before, after, actor, c);
    case 'start':
    case 'ready':
    case 'set-bot-level':
    case 'set-rules':
    case 'set-game-limit':
    case 'add-rounds':
      return [];
    default:
      return assertNever(c);
  }
}

/** The result of a finished game, from its record (names survive kicks). */
function resultEvent(record: GameRecord): LogEvent {
  const declarerId = record.declarerId;
  const ramsch = record.ramsch;
  const durchmarsch = ramsch?.durchmarschId ?? null;
  return {
    kind: 'result',
    number: record.number,
    outcome: record.outcome,
    declarerId,
    declarerName: declarerId === null ? null : (record.names[declarerId] ?? declarerId),
    game: record.game,
    won: record.outcome === 'played' ? record.won : null,
    gameValue: record.gameValue,
    declarerPoints: record.declarerPoints,
    defenderPoints: record.defenderPoints,
    loserNames: ramsch === null ? [] : ramsch.loserIds.map((id) => record.names[id] ?? id),
    durchmarschName: durchmarsch === null ? null : (record.names[durchmarsch] ?? durchmarsch),
  };
}

/** `ramsch` when this command moved the running game into Ramsch (everybody passed). */
function ramschStarted(before: TableState, after: TableState): LogEvent[] {
  const was = before.game;
  const now = after.game;
  if (was === null || now === null || was.number !== now.number) return [];
  return !was.engine.ramsch && now.engine.ramsch ? [{ kind: 'ramsch', number: now.number }] : [];
}

/**
 * The events of a successful command, in order: the command itself, the start of a Ramsch game,
 * the result of a game it finished, the start of Bock games, then the deal of a game it started.
 * Card plays and discards produce no events.
 */
export function commandLog(
  before: TableState,
  after: TableState,
  actor: PlayerId,
  command: TableCommand,
  record: GameRecord | null,
): LogEvent[] {
  const own = commandEvents(before, after, actor, command);
  const result = record === null ? [] : [resultEvent(record)];
  const bock: LogEvent[] = record?.bockTriggered === true ? [{ kind: 'bock-started', games: BOCK_GAMES }] : [];
  const game = after.game;
  const dealt: LogEvent[] = after.gameCounter > before.gameCounter && game !== null
    ? [{
        kind: 'dealt',
        number: game.number,
        dealerId: game.dealerId,
        dealerName: nameOf(after, game.dealerId),
        bock: game.bock,
      }]
    : [];
  return [...own, ...ramschStarted(before, after), ...result, ...bock, ...dealt];
}
