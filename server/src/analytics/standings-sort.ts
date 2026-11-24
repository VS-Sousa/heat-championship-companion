/** Mirror of src/app/core/data/shared/standings-sort.ts (server side). */
export interface StandingRow {
  driverId: string;
  driverName: string;
  nickname?: string;
  abbreviation: string;
  number: number;
  points: number;
  wins: number;
  podiums: number;
  p2Count: number;
  p3Count: number;
  lastWinRound?: number;
  races: number;
  inTitleFight?: boolean;
}

/** Full championship tiebreak: points → P1 → P2 → P3 → most recent win. */
export function compareStandingRows(a: StandingRow, b: StandingRow): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.wins !== a.wins) return b.wins - a.wins;
  if (b.p2Count !== a.p2Count) return b.p2Count - a.p2Count;
  if (b.p3Count !== a.p3Count) return b.p3Count - a.p3Count;
  const aLast = a.lastWinRound ?? -1;
  const bLast = b.lastWinRound ?? -1;
  if (bLast !== aLast) return bLast - aLast;
  return a.driverName.localeCompare(b.driverName);
}

export function sortStandingRows(rows: StandingRow[]): StandingRow[] {
  return [...rows].sort(compareStandingRows);
}

export function emptyStandingRow(
  base: Pick<StandingRow, 'driverId' | 'driverName' | 'nickname' | 'abbreviation' | 'number'>,
): StandingRow {
  return { ...base, points: 0, wins: 0, podiums: 0, p2Count: 0, p3Count: 0, races: 0 };
}

export function applyResultToStanding(
  row: StandingRow,
  result: { position: number; pointsAwarded: number },
  roundNumber?: number,
): void {
  row.points += result.pointsAwarded;
  row.races += 1;
  if (result.position === 1) {
    row.wins += 1;
    row.podiums += 1;
    if (roundNumber != null) {
      row.lastWinRound = Math.max(row.lastWinRound ?? -1, roundNumber);
    }
  } else if (result.position === 2) {
    row.p2Count += 1;
    row.podiums += 1;
  } else if (result.position === 3) {
    row.p3Count += 1;
    row.podiums += 1;
  }
}
