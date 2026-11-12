// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameConnection } from '../../net';
import { viewFor, type GameRecord } from '../../table';
import { ctxFor, playUntilRecords, tableWith } from '../../table/testing';
import { SeriesDialog } from './SeriesDialog';

afterEach(() => {
  cleanup();
});

function finishedTable(): { records: readonly GameRecord[]; view: ReturnType<typeof viewFor> } {
  let n = 3;
  const rand = (): number => {
    n = (n * 1664525 + 1013904223) % 4294967296;
    return n / 4294967296;
  };
  let s = tableWith(3, { bots: true });
  s = { ...s, gameLimit: 3 };
  const started = applyStart(s);
  const done = playUntilRecords(started, 3, () => ctxFor(1), rand);
  return { records: done.records, view: viewFor({ ...done, seriesOver: true }, 'p0') };
}

import { applyCommand, type TableState } from '../../table';
function applyStart(s: TableState): TableState {
  const r = applyCommand(s, 'p0', { type: 'start' }, ctxFor(1));
  if (!r.ok) throw new Error(r.error.code);
  return r.value.state;
}

describe('SeriesDialog', () => {
  it('shows a podium of three, the stats and lets the host add a round', () => {
    const { records, view } = finishedTable();
    const send = vi.fn();
    const connection = { send } as unknown as GameConnection;
    render(<SeriesDialog view={view} records={records} scoring="standard" connection={connection} onClose={() => undefined} />);
    const podium = screen.getByTestId('podium');
    expect(within(podium).getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByTestId('podium-1')).toBeTruthy();
    expect(within(screen.getByTestId('series-stats')).getAllByRole('row')).toHaveLength(4);
    fireEvent.click(screen.getByTestId('add-rounds'));
    expect(send).toHaveBeenCalledWith({ type: 'add-rounds' });
  });

  it('hides the add-round button from other players', () => {
    const { records, view } = finishedTable();
    const guest = { ...view, you: { ...view.you, id: 'p1' } };
    const connection = { send: vi.fn() } as unknown as GameConnection;
    render(<SeriesDialog view={guest} records={records} scoring="standard" connection={connection} onClose={() => undefined} />);
    expect(screen.queryByTestId('add-rounds')).toBeNull();
  });
});
