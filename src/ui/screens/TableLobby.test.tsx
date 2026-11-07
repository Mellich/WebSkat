// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameConnection } from '../../net';
import { applyCommand, createTable, viewFor, type TableCommand, type TableState } from '../../table';
import { useSettings } from '../store/settings';
import { TableLobby } from './TableLobby';

afterEach(() => {
  cleanup();
});

function run(s: TableState, actor: string, command: TableCommand): TableState {
  const result = applyCommand(s, actor, command, { now: 0, seed: 1 });
  if (!result.ok) throw new Error(result.error.message);
  return result.value.state;
}

/** Host "Hanna" plus two bots, one of them set to strong. */
function lobby(): TableState {
  let s = createTable({ key: 'ABCDEFGH', name: 'Friday', isPublic: false, hostId: 'h', hostName: 'Hanna' });
  s = run(run(s, 'h', { type: 'add-bot' }), 'h', { type: 'add-bot' });
  const second = s.players[2];
  if (second === undefined) throw new Error('test data: two bots expected');
  return run(s, 'h', { type: 'set-bot-level', playerId: second.id, level: 'strong' });
}

function connectionMock(): { connection: GameConnection; send: ReturnType<typeof vi.fn> } {
  const send = vi.fn();
  return { connection: { send } as unknown as GameConnection, send };
}

describe('TableLobby bot strength', () => {
  it('lets the host choose the strength of every bot', () => {
    useSettings.getState().update({ language: 'en' });
    const s = lobby();
    const { connection, send } = connectionMock();
    render(<TableLobby view={viewFor(s, 'h')} connection={connection} tableKey="ABCDEFGH" />);
    expect(screen.getByTestId<HTMLSelectElement>('bot-level-1').value).toBe('normal');
    expect(screen.getByTestId<HTMLSelectElement>('bot-level-2').value).toBe('strong');
    fireEvent.change(screen.getByTestId('bot-level-1'), { target: { value: 'easy' } });
    expect(send).toHaveBeenCalledWith({ type: 'set-bot-level', playerId: s.players[1]?.id, level: 'easy' });
  });

  it('shows the strengths to other players without letting them change it', () => {
    useSettings.getState().update({ language: 'en' });
    let s = lobby();
    s = { ...s, players: [...s.players, { id: 'g', name: 'Gast', connected: true, isBot: false }] };
    const { connection } = connectionMock();
    render(<TableLobby view={viewFor(s, 'g')} connection={connection} tableKey="ABCDEFGH" />);
    expect(screen.queryByTestId('bot-level-1')).toBeNull();
    expect(screen.getByTestId('seat-2').textContent).toContain('Strong');
  });

  it('enables Start with three players or bots', () => {
    useSettings.getState().update({ language: 'en' });
    const { connection } = connectionMock();
    render(<TableLobby view={viewFor(lobby(), 'h')} connection={connection} tableKey="ABCDEFGH" />);
    expect(screen.getByTestId<HTMLButtonElement>('start-game').disabled).toBe(false);
  });
});
