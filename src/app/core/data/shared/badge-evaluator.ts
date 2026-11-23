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

/** Pick winners per telemetry metric for a completed race. */
export function evaluateRaceBadges(input: {
  raceId: string;
  associationId?: string;
  telemetry: TelemetryEvent[];
  newId: () => string;
  now?: string;
}): BadgeAward[] {
  const counts = new Map<string, Map<string, number>>();
  for (const event of input.telemetry) {
    const metric = METRIC_BY_TYPE[event.type];
    if (!metric) continue;
    const byDriver = counts.get(metric) ?? new Map<string, number>();
    byDriver.set(event.driverId, (byDriver.get(event.driverId) ?? 0) + 1);
    counts.set(metric, byDriver);
  }

  const awards: BadgeAward[] = [];
  const awardedAt = input.now ?? new Date().toISOString();

  for (const [metric, byDriver] of counts) {
    const badgeId = BADGE_BY_METRIC[metric];
    if (!badgeId || !byDriver.size) continue;
    const ranked = [...byDriver.entries()].sort((a, b) => b[1] - a[1]);
    const topScore = ranked[0][1];
    if (topScore <= 0) continue;
    for (const [driverId, score] of ranked) {
      if (score !== topScore) break;
      awards.push({
        id: input.newId(),
        badgeId,
        driverId,
        raceId: input.raceId,
        associationId: input.associationId,
        awardedAt,
      });
    }
  }

  return awards;
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
