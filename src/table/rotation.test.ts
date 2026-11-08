import { describe, expect, it } from 'vitest';
import { pickFirstDealer, rolesForDealer, sittingOutSeats } from './rotation';
import { tableWith } from './testing';

describe('pickFirstDealer', () => {
  it('chooses a seat from the seed', () => {
    expect(pickFirstDealer(7, 3)).toBe(1);
    expect(pickFirstDealer(9, 3)).toBe(0);
    expect(pickFirstDealer(4294967295, 6)).toBe(4294967295 % 6);
  });
});

describe('sittingOutSeats (skat-rules §9)', () => {
  it.each([
    [3, 0, []],
    [4, 2, [2]],
    [5, 1, [1, 0]],
    [6, 4, [4, 2, 3]],
  ] as const)('N=%i dealer %i sits out %j', (n, dealer, expected) => {
    expect(sittingOutSeats(n, dealer)).toEqual(expected);
  });
});

describe('rolesForDealer', () => {
  for (const n of [3, 4, 5, 6]) {
    for (let dealer = 0; dealer < n; dealer++) {
      it(`N=${String(n)}, dealer seat ${String(dealer)}: forehand, middlehand, hindhand follow the dealer`, () => {
        const s = tableWith(n);
        const { roles, dealerId, sittingOut } = rolesForDealer(s.players, dealer);
        const seat = (k: number): string => s.players[(dealer + k) % n]?.id ?? '';

        expect(dealerId).toBe(seat(0));
        expect(roles).toEqual({ forehand: seat(1), middlehand: seat(2), hindhand: seat(3) });
        const expectedOut = n === 3 ? [] : [seat(0), ...Array.from({ length: n - 4 }, (_, i) => seat(4 + i))];
        expect([...sittingOut].sort()).toEqual([...expectedOut].sort());
      });
    }
  }

  it('gives three active players and no overlap with the sitting-out list', () => {
    const s = tableWith(6);
    const { roles, sittingOut } = rolesForDealer(s.players, 5);
    const active = Object.values(roles);
    expect(new Set(active).size).toBe(3);
    for (const id of sittingOut) {
      expect(active).not.toContain(id);
    }
  });

  it('refuses fewer than 3 players', () => {
    expect(() => rolesForDealer(tableWith(2).players, 0)).toThrow();
  });
});
