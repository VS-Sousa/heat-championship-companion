import { StandingRow } from '../../models/domain.models';
import { compareStandingRows } from './standings-sort';

export interface TitleFightInput {
  standings: StandingRow[];
  remainingPlanned: number;
  gridSize: number;
  pointSystem: number[];
}

function pointsForPos(pointSystem: number[], position: number): number {
  return pointSystem[position - 1] ?? 0;
}

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function cloneRow(row: StandingRow): StandingRow {
  return { ...row };
}

function applyFinish(
  row: StandingRow,
  position: number,
  pointSystem: number[],
  roundNumber: number
): void {
  row.points += pointsForPos(pointSystem, position);
  row.races += 1;
  if (position === 1) {
    row.wins += 1;
    row.podiums += 1;
    row.lastWinRound = roundNumber;
  } else if (position === 2) {
    row.p2Count += 1;
    row.podiums += 1;
  } else if (position === 3) {
    row.p3Count += 1;
    row.podiums += 1;
  }
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  const result: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const rest = items.slice(0, i).concat(items.slice(i + 1));
    for (const p of permutations(rest)) {
      result.push([items[i], ...p]);
    }
  }
  return result;
}

function isChampion(
  candidate: StandingRow,
  field: StandingRow[]
): boolean {
  const sorted = [...field].sort(compareStandingRows);
  return sorted[0]?.driverId === candidate.driverId;
}

/**
 * Heuristic: each remaining race, assign worst finishes to biggest title threats.
 */
function heuristicCanWin(
  base: StandingRow[],
  candidateId: string,
  remaining: number,
  gridSize: number,
  pointSystem: number[]
): boolean {
  const rows = base.map(cloneRow);
  const candidate = rows.find((r) => r.driverId === candidateId);
  if (!candidate) return false;
  const rivals = rows.filter((r) => r.driverId !== candidateId);

  for (let race = 0; race < remaining; race++) {
    const round = 10_000 + race;
    applyFinish(candidate, 1, pointSystem, round);
    rivals.sort((a, b) => compareStandingRows(a, b));
    let pos = gridSize;
    for (const rival of rivals) {
      applyFinish(rival, pos, pointSystem, round);
      pos -= 1;
      if (pos < 2) break;
    }
  }
  return isChampion(candidate, rows);
}

function dfsCanWin(
  base: StandingRow[],
  candidateId: string,
  remaining: number,
  gridSize: number,
  pointSystem: number[]
): boolean {
  const rivalIds = base
    .filter((r) => r.driverId !== candidateId)
    .map((r) => r.driverId);
  const rivalPerms = permutations(rivalIds);
  const maxRoundBase = Math.max(
    0,
    ...base.map((r) => r.lastWinRound ?? 0)
  );

  function search(depth: number, state: StandingRow[]): boolean {
    if (depth === remaining) {
      const cand = state.find((r) => r.driverId === candidateId)!;
      return isChampion(cand, state);
    }
    const round = maxRoundBase + depth + 1;
    for (const order of rivalPerms) {
      const next = state.map(cloneRow);
      const cand = next.find((r) => r.driverId === candidateId)!;
      applyFinish(cand, 1, pointSystem, round);
      order.forEach((id, idx) => {
        const rival = next.find((r) => r.driverId === id)!;
        applyFinish(rival, idx + 2, pointSystem, round);
      });
      // Prune: if some rival already cannot be caught even if cand wins rest
      const left = remaining - depth - 1;
      const candCeiling = cloneRow(cand);
      for (let i = 0; i < left; i++) {
        applyFinish(candCeiling, 1, pointSystem, round + i + 1);
      }
      let doomed = false;
      for (const r of next) {
        if (r.driverId === candidateId) continue;
        const rivalFloor = cloneRow(r);
        for (let i = 0; i < left; i++) {
          applyFinish(rivalFloor, gridSize, pointSystem, round + i + 1);
        }
        if (compareStandingRows(rivalFloor, candCeiling) < 0) {
          doomed = true;
          break;
        }
      }
      if (doomed) continue;
      if (search(depth + 1, next)) return true;
    }
    return false;
  }

  return search(0, base.map(cloneRow));
}

/**
 * Returns standing rows with `inTitleFight` set.
 * Does not mutate input standings array items in place for the return path.
 */
export function computeTitleContention(
  input: TitleFightInput
): StandingRow[] {
  const { standings, remainingPlanned, gridSize, pointSystem } = input;
  if (!standings.length) return [];

  if (remainingPlanned <= 0) {
    const sorted = [...standings].sort(compareStandingRows);
    const leader = sorted[0];
    return standings.map((row) => ({
      ...row,
      inTitleFight: compareStandingRows(row, leader) === 0,
    }));
  }

  const effectiveGrid = Math.max(gridSize, standings.length, 2);
  const branchFactor = factorial(Math.max(0, effectiveGrid - 1));
  const useExact =
    remainingPlanned > 0 &&
    branchFactor ** remainingPlanned <= 2_000_000 &&
    branchFactor <= 5040;

  // Ensure every standing driver is in the field; pad abbreviations already present
  const field = standings.map((s) => ({
    ...s,
    p2Count: s.p2Count ?? 0,
    p3Count: s.p3Count ?? 0,
  }));

  return field.map((row) => {
    const canWin = useExact
      ? dfsCanWin(
          field,
          row.driverId,
          remainingPlanned,
          effectiveGrid,
          pointSystem
        )
      : heuristicCanWin(
          field,
          row.driverId,
          remainingPlanned,
          effectiveGrid,
          pointSystem
        );
    return { ...row, inTitleFight: canWin };
  });
}
