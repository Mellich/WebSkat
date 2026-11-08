// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { GameRecord, TableView, ViewResult } from '../../table';
import { ResultDialog } from './ResultDialog';

afterEach(() => {
  cleanup();
});

const PLAYERS = [
  { id: 'a', name: 'Anna', connected: true, isBot: false, botLevel: null, seat: 0 },
  { id: 'b', name: 'Ben', connected: true, isBot: false, botLevel: null, seat: 1 },
  { id: 'c', name: 'Cem', connected: true, isBot: false, botLevel: null, seat: 2 },
];

const view: TableView = {
  seq: 1,
  table: {
    key: 'k',
    name: 'Table',
    hostId: 'a',
    maxSeats: 3,
    status: 'in-game',
    players: PLAYERS,
    pending: [],
    nextDealerId: null,
    readyIds: [],
  },
  you: { id: 'a', seat: 0, role: 'forehand' },
  game: null,
};

// Declarer Anna (forehand) plays Diamonds 18 and loses (skat-rules §10.7 example).
const lost: ViewResult = {
  kind: 'played',
  declarerId: 'a',
  bid: 18,
  declaration: { kind: 'suit', trump: 'D', hand: false, announce: 'none', ouvert: false },
  spitzen: { with: false, count: 2 },
  declarerPoints: 40,
  defenderPoints: 80,
  declarerTricks: 3,
  defenderTricks: 7,
  schneider: false,
  schwarz: false,
  base: 9,
  multiplier: 3,
  gameValue: 27,
  playedWon: false,
  overbid: false,
  won: false,
  loseValue: 27,
  declarerScore: -54,
};

const record: GameRecord = {
  id: 'k-1',
  number: 1,
  timestamp: 0,
  tableSize: 3,
  dealerId: 'c',
  roles: { forehand: 'a', middlehand: 'b', hindhand: 'c' },
  sittingOut: [],
  names: { a: 'Anna', b: 'Ben', c: 'Cem' },
  outcome: 'played',
  declarerId: 'a',
  bid: 18,
  game: 'diamonds',
  hand: false,
  ouvert: false,
  announce: 'none',
  spitzenWith: false,
  spitzenCount: 2,
  multiplier: 3,
  gameValue: 27,
  declarerPoints: 40,
  defenderPoints: 80,
  declarerTricks: 3,
  schneider: false,
  schwarz: false,
  overbid: false,
  won: false,
  scores: {
    standard: { a: -54, b: 0, c: 0 },
    seeger: { a: -104, b: 40, c: 40 },
  },
};

function scoreCells(): string[] {
  const table = screen.getByRole('table');
  return within(table)
    .getAllByRole('cell')
    .filter((_, i) => i % 2 === 1)
    .map((cell) => cell.textContent);
}

describe('ResultDialog score table', () => {
  it('shows the Seeger deltas and names the system when Seeger scoring is selected', () => {
    render(<ResultDialog view={view} result={lost} record={record} scoring="seeger" onContinue={() => undefined} />);
    expect(scoreCells()).toEqual(['−104', '+40', '+40']);
    expect(screen.getByText('Score change (Seeger–Fabian)')).toBeTruthy();
  });

  it('shows the standard deltas and names the system when standard scoring is selected', () => {
    render(<ResultDialog view={view} result={lost} record={record} scoring="standard" onContinue={() => undefined} />);
    expect(scoreCells()).toEqual(['−54', '0', '0']);
    expect(screen.getByText('Score change (Standard)')).toBeTruthy();
  });

  it('shows a placeholder in every score cell while the record has not arrived', () => {
    render(<ResultDialog view={view} result={lost} record={null} scoring="seeger" onContinue={() => undefined} />);
    expect(scoreCells()).toEqual(['…', '…', '…']);
  });

  it('shows no score table when everybody passed', () => {
    render(
      <ResultDialog view={view} result={{ kind: 'passed-in' }} record={null} scoring="seeger" onContinue={() => undefined} />,
    );
    expect(screen.getByText('Everybody passed: no game.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
