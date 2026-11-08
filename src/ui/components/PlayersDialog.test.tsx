// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameConnection } from '../../net';
import { applyCommand, createTable, viewFor, type Player, type TableCommand, type TableState } from '../../table';
import { useSettings } from '../store/settings';
import { PlayersDialog } from './PlayersDialog';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  useSettings.getState().update({ language: 'en' });
});

function run(s: TableState, actor: string, command: TableCommand): TableState {
  const result = applyCommand(s, actor, command, { now: 0, seed: 3 });
  if (!result.ok) throw new Error(result.error.message);
  return result.value.state;
}

function human(id: string, name: string, connected = true): Player {
  return { id, name, connected, isBot: false };
}

/** Host Hanna, Anna (connected), Ben (disconnected); Carl waits in `pending`. */
function table(options: { started: boolean }): TableState {
  let s = createTable({ key: 'ABCDEFGH', name: 'Friday', isPublic: false, hostId: 'h', hostName: 'Hanna' });
  s = { ...s, players: [...s.players, human('a', 'Anna'), human('b', 'Ben', false)] };
  if (options.started) s = run(s, 'h', { type: 'start' });
  return { ...s, pending: [human('c', 'Carl')] };
}

function connectionMock(): { connection: GameConnection; send: ReturnType<typeof vi.fn> } {
  const send = vi.fn();
  return { connection: { send } as unknown as GameConnection, send };
}

function renderDialog(s: TableState, viewer: string, invite: ((id: string) => string | null) | null = null) {
  const { connection, send } = connectionMock();
  const onClose = vi.fn();
  render(
    <PlayersDialog view={viewFor(s, viewer)} connection={connection} invite={invite} onClose={onClose} />,
  );
  return { send, onClose };
}

describe('PlayersDialog during a game', () => {
  it('lets the host replace a seated player by a waiting player', () => {
    const { send } = renderDialog(table({ started: true }), 'h');
    fireEvent.click(screen.getByTestId('replace-2'));
    fireEvent.change(screen.getByTestId('replace-with'), { target: { value: 'c' } });
    fireEvent.click(screen.getByTestId('replace-confirm'));
    expect(send).toHaveBeenCalledWith({ type: 'replace-player', playerId: 'b', by: { kind: 'pending', playerId: 'c' } });
  });

  it('lets the host replace a seated player by a bot', () => {
    const { send } = renderDialog(table({ started: true }), 'h');
    fireEvent.click(screen.getByTestId('replace-1'));
    fireEvent.change(screen.getByTestId('replace-with'), { target: { value: 'bot' } });
    fireEvent.click(screen.getByTestId('replace-confirm'));
    expect(send).toHaveBeenCalledWith({
      type: 'replace-player',
      playerId: 'a',
      by: { kind: 'bot', level: 'normal' },
    });
  });

  it('lets the host choose the strength of a bot that replaces a player', () => {
    const { send } = renderDialog(table({ started: true }), 'h');
    fireEvent.click(screen.getByTestId('replace-1'));
    fireEvent.change(screen.getByTestId('replace-with'), { target: { value: 'bot' } });
    fireEvent.change(screen.getByTestId('replace-level'), { target: { value: 'strong' } });
    fireEvent.click(screen.getByTestId('replace-confirm'));
    expect(send).toHaveBeenCalledWith({
      type: 'replace-player',
      playerId: 'a',
      by: { kind: 'bot', level: 'strong' },
    });
  });

  it('shows no strength choice when a waiting player takes the seat', () => {
    renderDialog(table({ started: true }), 'h');
    fireEvent.click(screen.getByTestId('replace-2'));
    expect(screen.queryByTestId('replace-level')).toBeNull();
  });

  it('shows the roles of the game and the waiting players', () => {
    renderDialog(table({ started: true }), 'h');
    expect(screen.getByTestId('players-row-1').textContent).toContain('Forehand');
    expect(screen.getByTestId('players-pending').textContent).toContain('Carl');
    expect(screen.getByTestId('players-abort-game')).toBeTruthy();
  });

  it('gives a guest no player controls', () => {
    renderDialog(table({ started: true }), 'a');
    expect(screen.queryByTestId('replace-1')).toBeNull();
    expect(screen.queryByTestId('replace-2')).toBeNull();
    expect(screen.queryByTestId('players-kick-1')).toBeNull();
    expect(screen.queryByTestId('players-abort-game')).toBeNull();
  });

  it('offers no kick while a game runs', () => {
    renderDialog(table({ started: true }), 'h');
    expect(screen.queryByTestId('players-kick-1')).toBeNull();
  });
});

describe('PlayersDialog in the lobby', () => {
  it('kicks a seated player after confirmation', () => {
    const { send } = renderDialog(table({ started: false }), 'h');
    fireEvent.click(screen.getByTestId('players-kick-1'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(send).toHaveBeenCalledWith({ type: 'kick', playerId: 'a' });
  });
});

describe('PlayersDialog invites', () => {
  it('shows the formatted code and the link for a disconnected player', () => {
    const invite = vi.fn(() => 'WXYZ2345');
    renderDialog(table({ started: true }), 'h', invite);
    fireEvent.click(screen.getByTestId('reinvite-2'));
    expect(invite).toHaveBeenCalledWith('b');
    expect(screen.getByTestId('invite-code').textContent).toBe('WXYZ-2345');
    expect(screen.getByTestId('invite-link').textContent).toContain('#/t/ABCD-EFGH?invite=WXYZ-2345');
  });

  it('explains when no invite can be made', () => {
    renderDialog(table({ started: true }), 'h', () => null);
    fireEvent.click(screen.getByTestId('reinvite-2'));
    expect(screen.queryByTestId('invite-code')).toBeNull();
    expect(screen.getByText('Only disconnected players can be invited again.')).toBeTruthy();
  });

  it('offers no invite for connected players', () => {
    renderDialog(table({ started: true }), 'h', () => 'WXYZ2345');
    expect(screen.queryByTestId('reinvite-1')).toBeNull();
  });
});
