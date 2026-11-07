import { describe, expect, it } from 'vitest';
import { addPlayer, setConnected } from './seating';
import { ctxFor, tableWith } from './testing';
import { applyCommand, createTable } from './table';
import type { Ctx, PlayerId, TableCommand, TableErrorCode, TableState } from './types';

const CTX: Ctx = ctxFor(42, 1000);

function apply(s: TableState, actor: PlayerId, c: TableCommand, ctx: Ctx = CTX): TableState {
  const result = applyCommand(s, actor, c, ctx);
  if (!result.ok) throw new Error(`${c.type} by ${actor} rejected: ${result.error.code}`);
  return result.value.state;
}

function errorOf(s: TableState, actor: PlayerId, c: TableCommand): TableErrorCode {
  const result = applyCommand(s, actor, c, CTX);
  if (result.ok) throw new Error(`${c.type} by ${actor} was accepted`);
  return result.error.code;
}

const PASS = { type: 'game', action: { type: 'pass' } } as const;

/** Everybody passes: a passed-in game with the three active players of the first deal. */
function passedIn(s: TableState): TableState {
  const game = s.game;
  if (game === null) throw new Error('no game');
  const order = [game.roles.middlehand, game.roles.hindhand, game.roles.forehand];
  return order.reduce((state, id) => apply(state, id, PASS), s);
}

function startedWith(n: number): TableState {
  return apply(tableWith(n), 'p0', { type: 'start' });
}

describe('start', () => {
  it('is for the host only', () => {
    expect(errorOf(tableWith(3), 'p1', { type: 'start' })).toBe('NOT_HOST');
  });

  it('needs at least three players', () => {
    expect(errorOf(tableWith(2), 'p0', { type: 'start' })).toBe('TOO_FEW_PLAYERS');
  });

  it('deals the first game with the first dealer chosen from the seed', () => {
    const s = startedWith(3);
    expect(s).toMatchObject({ status: 'in-game', gameCounter: 1, nextDealerIdx: 1 });
    expect(s.game).toMatchObject({ number: 1, dealerId: 'p0', seatsAtDeal: 3 });
    expect(s.game?.roles).toEqual({ forehand: 'p1', middlehand: 'p2', hindhand: 'p0' });
  });

  it('cannot start twice', () => {
    expect(errorOf(startedWith(3), 'p0', { type: 'start' })).toBe('WRONG_STATUS');
  });
});

describe('game command', () => {
  it('refuses a seated player who sits out', () => {
    const s = startedWith(4);
    const dealer = s.game?.dealerId ?? '';
    expect(s.game?.sittingOut).toEqual([dealer]);
    expect(errorOf(s, dealer, PASS)).toBe('NOT_ACTIVE_PLAYER');
  });

  it('passes engine errors through', () => {
    const s = startedWith(3);
    const middlehand = s.game?.roles.middlehand ?? '';
    expect(errorOf(s, middlehand, { type: 'game', action: { type: 'hold' } })).toBe('CANNOT_HOLD');
  });

  it('is refused when no game is running', () => {
    expect(errorOf(tableWith(3), 'p0', PASS)).toBe('WRONG_STATUS');
  });
});

describe('a finished game', () => {
  it('creates one record and waits for every connected human to be ready', () => {
    const finished = passedIn(startedWith(3));
    expect(finished.records).toHaveLength(1);
    expect(finished.records[0]).toMatchObject({ outcome: 'passed-in', id: 'TESTKEY-1', timestamp: 1000 });
    expect(finished.game?.engine.phase).toBe('finished');
    expect(finished.game?.recorded).toBe(true);

    const afterTwo = ['p0', 'p1'].reduce((s, id) => apply(s, id, { type: 'ready' }), finished);
    expect(afterTwo.gameCounter).toBe(1);
    expect(afterTwo.game?.engine.phase).toBe('finished');

    const dealt = apply(afterTwo, 'p2', { type: 'ready' });
    expect(dealt.gameCounter).toBe(2);
    expect(dealt.game).toMatchObject({ number: 2, dealerId: 'p1' });
    expect(dealt.game?.engine.phase).toBe('bidding');
    expect(dealt.records).toHaveLength(1);
  });

  it('does not wait for a disconnected human', () => {
    const offline = setConnected(passedIn(startedWith(3)), 'p2', false);
    const dealt = ['p0', 'p1'].reduce((s, id) => apply(s, id, { type: 'ready' }), offline);
    expect(dealt.gameCounter).toBe(2);
  });

  it('refuses ready outside a finished game, and from players who are not seated', () => {
    expect(errorOf(startedWith(3), 'p0', { type: 'ready' })).toBe('WRONG_STATUS');
    const added = addPlayer(passedIn(startedWith(3)), { id: 'late', name: 'Late' });
    if (!added.ok) throw new Error(added.error.message);
    expect(errorOf(added.value, 'late', { type: 'ready' })).toBe('NOT_SEATED');
  });

  it('seats players who joined during the game after it', () => {
    const added = addPlayer(startedWith(3), { id: 'late', name: 'Late' });
    if (!added.ok) throw new Error(added.error.message);
    const finished = passedIn(added.value);
    const dealt = ['p0', 'p1', 'p2'].reduce((s, id) => apply(s, id, { type: 'ready' }), finished);
    expect(dealt.players.map((p) => p.id)).toEqual(['p0', 'p1', 'p2', 'late']);
    expect(dealt.pending).toEqual([]);
  });
});

describe('abort-game', () => {
  it('is for the host only and needs a running game', () => {
    expect(errorOf(startedWith(3), 'p1', { type: 'abort-game' })).toBe('NOT_HOST');
    expect(errorOf(tableWith(3), 'p0', { type: 'abort-game' })).toBe('WRONG_STATUS');
  });

  it('discards the game without a record and deals the next one', () => {
    const aborted = apply(startedWith(3), 'p0', { type: 'abort-game' });
    expect(aborted.records).toEqual([]);
    expect(aborted.gameCounter).toBe(2);
    expect(aborted.game).toMatchObject({ number: 2, dealerId: 'p1' });
  });
});

describe('kick', () => {
  it('is for the host only, not during a running game, and not for the host', () => {
    expect(errorOf(tableWith(3), 'p1', { type: 'kick', playerId: 'p2' })).toBe('NOT_HOST');
    expect(errorOf(startedWith(3), 'p0', { type: 'kick', playerId: 'p2' })).toBe('GAME_RUNNING');
    expect(errorOf(tableWith(3), 'p0', { type: 'kick', playerId: 'p0' })).toBe('CANNOT_KICK_HOST');
    expect(errorOf(tableWith(3), 'p0', { type: 'kick', playerId: 'ghost' })).toBe('UNKNOWN_PLAYER');
  });

  it('removes a seated player in the lobby', () => {
    const s = apply(tableWith(4), 'p0', { type: 'kick', playerId: 'p2' });
    expect(s.players.map((p) => p.id)).toEqual(['p0', 'p1', 'p3']);
  });

  it('returns to the lobby when fewer than three players remain after a game', () => {
    const finished = passedIn(startedWith(3));
    const kicked = apply(finished, 'p0', { type: 'kick', playerId: 'p2' });
    expect(kicked).toMatchObject({ status: 'lobby', game: null });
    expect(kicked.players).toHaveLength(2);
    expect(kicked.records).toHaveLength(1);
  });

  it('keeps the records of a kicked player', () => {
    const finished = passedIn(startedWith(4));
    const kicked = apply(finished, 'p0', { type: 'kick', playerId: 'p3' });
    expect(kicked.records[0]?.names['p3']).toBe('Player 3');
  });
});

describe('add-bot', () => {
  it('seats a bot in the lobby and numbers it uniquely', () => {
    const once = apply(tableWith(2), 'p0', { type: 'add-bot' });
    const twice = apply(once, 'p0', { type: 'add-bot' });
    expect(twice.players.map((p) => p.name)).toEqual(['Host', 'Player 1', 'Bot', 'Bot (2)']);
    expect(twice.players.filter((p) => p.isBot)).toHaveLength(2);
  });

  it('is refused for non-hosts, during a running game and for a full table', () => {
    expect(errorOf(tableWith(2), 'p1', { type: 'add-bot' })).toBe('NOT_HOST');
    expect(errorOf(startedWith(3), 'p0', { type: 'add-bot' })).toBe('GAME_RUNNING');
    expect(errorOf(tableWith(3, { maxSeats: 3 }), 'p0', { type: 'add-bot' })).toBe('TABLE_FULL');
  });

  it('gives a new bot the normal strength', () => {
    const s = apply(tableWith(2), 'p0', { type: 'add-bot' });
    expect(s.players.find((p) => p.isBot)?.botLevel).toBe('normal');
  });
});

describe('set-bot-level', () => {
  const withBots = (): TableState => apply(apply(tableWith(1), 'p0', { type: 'add-bot' }), 'p0', { type: 'add-bot' });

  it('changes the strength of one bot only', () => {
    const s = withBots();
    const [first, second] = s.players.filter((p) => p.isBot);
    if (first === undefined || second === undefined) throw new Error('test data: two bots expected');
    const next = apply(s, 'p0', { type: 'set-bot-level', playerId: first.id, level: 'strong' });
    expect(next.players.find((p) => p.id === first.id)?.botLevel).toBe('strong');
    expect(next.players.find((p) => p.id === second.id)?.botLevel).toBe('normal');
    expect(next.seq).toBeGreaterThan(s.seq);
  });

  it('is allowed during a running game', () => {
    const s = withBots();
    const started = apply(s, 'p0', { type: 'start' });
    const bot = started.players.find((p) => p.isBot);
    if (bot === undefined) throw new Error('test data: a bot expected');
    expect(apply(started, 'p0', { type: 'set-bot-level', playerId: bot.id, level: 'easy' }).players.find((p) => p.id === bot.id)?.botLevel).toBe('easy');
  });

  it('is refused for non-hosts, humans and unknown players', () => {
    const s = apply(tableWith(2), 'p0', { type: 'add-bot' });
    const bot = s.players.find((p) => p.isBot);
    if (bot === undefined) throw new Error('test data: a bot expected');
    expect(errorOf(s, 'p1', { type: 'set-bot-level', playerId: bot.id, level: 'easy' })).toBe('NOT_HOST');
    expect(errorOf(s, 'p0', { type: 'set-bot-level', playerId: 'p1', level: 'easy' })).toBe('NOT_A_BOT');
    expect(errorOf(s, 'p0', { type: 'set-bot-level', playerId: 'nobody', level: 'easy' })).toBe('UNKNOWN_PLAYER');
  });
});

describe('table size', () => {
  it('offers six seats by default and starts with three players or bots', () => {
    const s = createTable({ key: 'K', name: 'T', isPublic: false, hostId: 'p0', hostName: 'Host' });
    expect(s.maxSeats).toBe(6);
    const withBots = apply(apply(s, 'p0', { type: 'add-bot' }), 'p0', { type: 'add-bot' });
    expect(apply(withBots, 'p0', { type: 'start' }).status).toBe('in-game');
    expect(errorOf(apply(s, 'p0', { type: 'add-bot' }), 'p0', { type: 'start' })).toBe('TOO_FEW_PLAYERS');
  });
});

describe('leave', () => {
  it('is refused for the host', () => {
    expect(errorOf(tableWith(3), 'p0', { type: 'leave' })).toBe('HOST_CANNOT_LEAVE');
  });

  it('removes a player in the lobby', () => {
    const s = apply(tableWith(3), 'p2', { type: 'leave' });
    expect(s.players.map((p) => p.id)).toEqual(['p0', 'p1']);
  });

  it('only disconnects a player during a running game, so they can come back', () => {
    const s = apply(startedWith(3), 'p2', { type: 'leave' });
    expect(s.players.find((p) => p.id === 'p2')?.connected).toBe(false);
    expect(s.players).toHaveLength(3);
  });

  it('reports strangers', () => {
    expect(errorOf(tableWith(3), 'nobody', { type: 'leave' })).toBe('UNKNOWN_PLAYER');
  });
});
