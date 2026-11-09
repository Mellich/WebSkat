// The table reducer: applyCommand(state, actor, command, ctx) (docs/table.md §3).

import {
  applyAction,
  assertNever,
  err,
  newGame,
  ok,
  type GameAction,
  type Result,
} from '../engine';
import { makeRecord } from './records';
import { replacePlayer } from './replace';
import { DEFAULT_RULES, setRules } from './rules';
import { pickFirstDealer, roleOf, rolesForDealer } from './rotation';
import {
  MAX_SEATS,
  MIN_SEATS,
  addPlayer,
  allPlayers,
  markLeaving,
  removeLeavers,
  removePlayer,
  touch,
  uniqueName,
} from './seating';
import type {
  ActiveGame,
  Ctx,
  GameRecord,
  Player,
  PlayerId,
  TableCommand,
  TableErrorCode,
  BotLevel,
  TableState,
} from './types';

export interface CommandResult {
  readonly state: TableState;
  readonly record: GameRecord | null;
}

type Outcome = Result<CommandResult, TableErrorCode>;

export function createTable(args: {
  readonly key: string;
  readonly name: string;
  readonly isPublic: boolean;
  readonly hostId: PlayerId;
  readonly hostName: string;
  /** Seat limit; defaults to the maximum (6). Players decide the table size by joining. */
  readonly maxSeats?: number;
}): TableState {
  const host: Player = {
    id: args.hostId,
    name: args.hostName.trim(),
    connected: true,
    isBot: false,
  };
  return {
    key: args.key,
    name: args.name,
    isPublic: args.isPublic,
    hostId: args.hostId,
    maxSeats: Math.min(MAX_SEATS, Math.max(MIN_SEATS, args.maxSeats ?? MAX_SEATS)),
    status: 'lobby',
    players: [host],
    pending: [],
    nextDealerIdx: 0,
    gameCounter: 0,
    game: null,
    ready: [],
    rules: DEFAULT_RULES,
    records: [],
    seq: 0,
  };
}

const plain = (state: TableState): Outcome => ok({ state, record: null });

const notHost = (): Outcome => err('NOT_HOST', 'Only the host can do this.');
const gameRunning = (): Outcome => err('GAME_RUNNING', 'Wait until the game is finished.');
const noFinishedGame = (): Outcome => err('WRONG_STATUS', 'No finished game to continue from.');

/** Deals the next game with the players and the dealer pointer as they are now. Leavers go first. */
export function dealNext(state: TableState, ctx: Ctx): TableState {
  const s = removeLeavers(state);
  const seated = allPlayers(s);
  if (seated.length < MIN_SEATS) {
    return touch({ ...s, players: seated, pending: [], game: null, status: 'lobby', ready: [] });
  }
  const n = seated.length;
  const dealerIdx = s.nextDealerIdx % n;
  const rotation = rolesForDealer(seated, dealerIdx);
  const game: ActiveGame = {
    number: s.gameCounter + 1,
    engine: newGame(ctx.seed, { ramschOnPassIn: s.rules.ramsch }),
    roles: rotation.roles,
    sittingOut: rotation.sittingOut,
    dealerId: rotation.dealerId,
    seed: ctx.seed,
    seatsAtDeal: n,
    recorded: false,
  };
  return touch({
    ...s,
    players: seated,
    pending: [],
    game,
    gameCounter: s.gameCounter + 1,
    nextDealerIdx: (dealerIdx + 1) % n,
    status: 'in-game',
    ready: seated.filter((p) => p.isBot).map((p) => p.id),
  });
}

/** Deals the next game once every connected human at the table has pressed "ready". */
export function tryDeal(s: TableState, ctx: Ctx): TableState {
  if (s.game === null || s.game.engine.phase !== 'finished') return s;
  const allReady = s.players.every((p) => p.isBot || !p.connected || s.ready.includes(p.id));
  return allReady ? dealNext(s, ctx) : s;
}

/** Back to the lobby when fewer than three players remain; pending players are seated. */
function toLobbyIfTooFew(s: TableState): TableState {
  if (s.players.length >= MIN_SEATS) return s;
  return touch({ ...s, players: allPlayers(s), pending: [], game: null, status: 'lobby', ready: [] });
}

function finishGame(s: TableState, game: ActiveGame, ctx: Ctx): CommandResult {
  const record = makeRecord(s, game, ctx);
  const finished = touch({
    ...s,
    game: { ...game, recorded: true },
    records: [...s.records, record],
    ready: s.players.filter((p) => p.isBot).map((p) => p.id),
  });
  return { state: tryDeal(finished, ctx), record };
}

function start(s: TableState, actor: PlayerId, ctx: Ctx): Outcome {
  if (actor !== s.hostId) return notHost();
  if (s.status !== 'lobby') return err('WRONG_STATUS', 'The game has already started.');
  if (s.players.length < MIN_SEATS) {
    return err('TOO_FEW_PLAYERS', `At least ${String(MIN_SEATS)} players are needed.`);
  }
  const first = { ...s, nextDealerIdx: pickFirstDealer(ctx.seed, s.players.length) };
  return plain(dealNext(first, ctx));
}

function playAction(s: TableState, actor: PlayerId, action: GameAction, ctx: Ctx): Outcome {
  const game = s.game;
  if (game === null || game.engine.phase === 'finished') {
    return err('WRONG_STATUS', 'No game is running.');
  }
  const role = roleOf(game, actor);
  if (role === null) {
    return err('NOT_ACTIVE_PLAYER', 'Only the active players can act in this game.');
  }
  const applied = applyAction(game.engine, role, action);
  if (!applied.ok) {
    return err(applied.error.code, applied.error.message);
  }
  const updated: ActiveGame = { ...game, engine: applied.value };
  const next = touch({ ...s, game: updated });
  if (updated.engine.phase !== 'finished') return plain(next);
  return ok(finishGame(next, updated, ctx));
}

function markReady(s: TableState, actor: PlayerId, ctx: Ctx): Outcome {
  if (s.game === null || s.game.engine.phase !== 'finished') return noFinishedGame();
  if (!s.players.some((p) => p.id === actor)) {
    return err('NOT_SEATED', 'Only seated players can continue.');
  }
  const next = touch({ ...s, ready: s.ready.includes(actor) ? s.ready : [...s.ready, actor] });
  return plain(tryDeal(next, ctx));
}

function abortGame(s: TableState, actor: PlayerId, ctx: Ctx): Outcome {
  if (actor !== s.hostId) return notHost();
  if (s.game === null || s.game.engine.phase === 'finished') {
    return err('WRONG_STATUS', 'No running game to abort.');
  }
  return plain(dealNext(s, ctx));
}

function kick(s: TableState, actor: PlayerId, target: PlayerId, ctx: Ctx): Outcome {
  if (actor !== s.hostId) return notHost();
  if (s.game !== null && s.game.engine.phase !== 'finished') return gameRunning();
  if (target === s.hostId) return err('CANNOT_KICK_HOST', 'The host cannot be kicked.');
  if (!allPlayers(s).some((p) => p.id === target)) {
    return err('UNKNOWN_PLAYER', 'No such player at this table.');
  }
  return plain(tryDeal(toLobbyIfTooFew(removePlayer(s, target)), ctx));
}

function addBot(s: TableState): Outcome {
  if (s.game !== null && s.game.engine.phase !== 'finished') return gameRunning();
  const botName = uniqueName(
    allPlayers(s).map((p) => p.name),
    'Bot',
  );
  const added = addPlayer(s, { id: `bot-${String(s.seq)}`, name: botName, isBot: true, botLevel: 'normal' });
  return added.ok ? plain(added.value) : err(added.error.code, added.error.message);
}

/** The host sets a bot's strength; allowed at any time, it applies from the bot's next action. */
function setBotLevel(s: TableState, target: PlayerId, level: BotLevel): Outcome {
  const player = allPlayers(s).find((p) => p.id === target);
  if (player === undefined) return err('UNKNOWN_PLAYER', 'No such player at this table.');
  if (!player.isBot) return err('NOT_A_BOT', 'Only bots have a strength.');
  const update = (p: Player): Player => (p.id === target ? { ...p, botLevel: level } : p);
  return plain({ ...s, players: s.players.map(update), pending: s.pending.map(update), seq: s.seq + 1 });
}

function leave(s: TableState, actor: PlayerId, ctx: Ctx): Outcome {
  if (actor === s.hostId) return err('HOST_CANNOT_LEAVE', 'The host cannot leave the table.');
  if (s.pending.some((p) => p.id === actor)) return plain(removePlayer(s, actor));
  if (!s.players.some((p) => p.id === actor)) {
    return err('UNKNOWN_PLAYER', 'You are not at this table.');
  }
  if (s.game !== null && s.game.engine.phase !== 'finished') {
    return plain(markLeaving(s, actor));
  }
  return plain(tryDeal(toLobbyIfTooFew(removePlayer(s, actor)), ctx));
}

export function applyCommand(
  s: TableState,
  actor: PlayerId,
  c: TableCommand,
  ctx: Ctx,
): Outcome {
  switch (c.type) {
    case 'start':
      return start(s, actor, ctx);
    case 'game':
      return playAction(s, actor, c.action, ctx);
    case 'ready':
      return markReady(s, actor, ctx);
    case 'abort-game':
      return abortGame(s, actor, ctx);
    case 'kick':
      return kick(s, actor, c.playerId, ctx);
    case 'replace-player': {
      const replaced = replacePlayer(s, actor, c.playerId, c.by);
      return replaced.ok ? plain(tryDeal(replaced.value, ctx)) : replaced;
    }
    case 'add-bot':
      return actor === s.hostId ? addBot(s) : notHost();
    case 'set-bot-level':
      return actor === s.hostId ? setBotLevel(s, c.playerId, c.level) : notHost();
    case 'leave':
      return leave(s, actor, ctx);
    case 'set-rules': {
      const set = setRules(s, actor, c.rules);
      return set.ok ? plain(set.value) : set;
    }
    default:
      return assertNever(c);
  }
}

