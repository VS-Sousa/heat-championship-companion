import {
  BadgeAward,
  TelemetryEvent,
  TelemetryEventType,
} from '../../models/domain.models';

const METRIC_BY_TYPE: Record<TelemetryEventType, string> = {
  slipstream_overtake: 'slipstream_overtakes',
  corner_speed_ok: 'corner_speed_ok',
  fastest_turn: 'fastest_turn',
  corner_spin: 'corner_spins',
};

const BADGE_BY_METRIC: Record<string, string> = {
  slipstream_overtakes: 'vacuum_architect',
  corner_speed_ok: 'lead_foot',
  fastest_turn: 'swiss_watch',
  corner_spins: 'russian_roulette',
};

/** Badge ids awarded from race_results (grid/finish/driver of the day). */
export const RESULT_BADGE_IDS = {
  poleConverter: 'pole_converter',
  comebackKing: 'comeback_king',
  cleanSweep: 'clean_sweep',
} as const;

/** Minimal result shape needed to evaluate result-based badges. */
export interface BadgeResultInput {
  driverId: string;
  gridPosition: number;
  position: number;
  driverOfTheDay?: boolean;
}

/** Pick winners per telemetry metric for a completed race. */
function evaluateTelemetryBadges(telemetry: TelemetryEvent[]): {
  badgeId: string;
  driverId: string;
}[] {
  const counts = new Map<string, Map<string, number>>();
  for (const event of telemetry) {
    const metric = METRIC_BY_TYPE[event.type];
    if (!metric) continue;
    const byDriver = counts.get(metric) ?? new Map<string, number>();
    byDriver.set(event.driverId, (byDriver.get(event.driverId) ?? 0) + 1);
    counts.set(metric, byDriver);
  }

  const winners: { badgeId: string; driverId: string }[] = [];
  for (const [metric, byDriver] of counts) {
    const badgeId = BADGE_BY_METRIC[metric];
    if (!badgeId || !byDriver.size) continue;
    const ranked = [...byDriver.entries()].sort((a, b) => b[1] - a[1]);
    const topScore = ranked[0][1];
    if (topScore <= 0) continue;
    for (const [driverId, score] of ranked) {
      if (score !== topScore) break;
      winners.push({ badgeId, driverId });
    }
  }
  return winners;
}

/** Pick winners derived from the race results table. */
function evaluateResultBadges(results: BadgeResultInput[]): {
  badgeId: string;
  driverId: string;
}[] {
  const winners: { badgeId: string; driverId: string }[] = [];

  // Pole converter + clean sweep (pole, win and driver of the day).
  for (const result of results) {
    if (result.gridPosition === 1 && result.position === 1) {
      winners.push({
        badgeId: RESULT_BADGE_IDS.poleConverter,
        driverId: result.driverId,
      });
      if (result.driverOfTheDay) {
        winners.push({
          badgeId: RESULT_BADGE_IDS.cleanSweep,
          driverId: result.driverId,
        });
      }
    }
  }

  // Comeback king: largest positive grid -> finish gain (ties share the badge).
  let bestGain = 0;
  for (const result of results) {
    bestGain = Math.max(bestGain, result.gridPosition - result.position);
  }
  if (bestGain >= 1) {
    for (const result of results) {
      if (result.gridPosition - result.position === bestGain) {
        winners.push({
          badgeId: RESULT_BADGE_IDS.comebackKing,
          driverId: result.driverId,
        });
      }
    }
  }

  return winners;
}

/** Evaluate every badge (telemetry + results) for a completed race. */
export function evaluateRaceBadges(input: {
  raceId: string;
  associationId?: string;
  telemetry: TelemetryEvent[];
  results?: BadgeResultInput[];
  newId: () => string;
  now?: string;
}): BadgeAward[] {
  const awardedAt = input.now ?? new Date().toISOString();
  const winners = [
    ...evaluateTelemetryBadges(input.telemetry),
    ...evaluateResultBadges(input.results ?? []),
  ];
  return winners.map(({ badgeId, driverId }) => ({
    id: input.newId(),
    badgeId,
    driverId,
    raceId: input.raceId,
    associationId: input.associationId,
    awardedAt,
  }));
}

/** Resolve corner order for reverse tracks (1-based). */
export function resolveCornerOrder(
  cornersCount: number,
  logicalOrder: number,
  reverse: boolean
): number {
  if (!reverse || cornersCount <= 0) return logicalOrder;
  return cornersCount - logicalOrder + 1;
}
