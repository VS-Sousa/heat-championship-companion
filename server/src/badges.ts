// Server-side mirror of src/app/core/data/shared/badge-evaluator.ts.
// Keep the two implementations in sync (the server has its own tsconfig rootDir).

export interface TelemetryEventInput {
  type: string;
  driverId: string;
}

export interface BadgeResultInput {
  driverId: string;
  gridPosition: number;
  position: number;
  driverOfTheDay?: boolean;
}

export interface BadgeWinner {
  badgeId: string;
  driverId: string;
}

const BADGE_BY_TELEMETRY_TYPE: Record<string, string> = {
  fastest_turn: 'swiss_watch',
  slipstream_overtake: 'vacuum_architect',
  corner_speed_ok: 'lead_foot',
  corner_spin: 'russian_roulette',
};

export function evaluateRaceBadges(input: {
  telemetry: TelemetryEventInput[];
  results: BadgeResultInput[];
}): BadgeWinner[] {
  const winners: BadgeWinner[] = [];

  // Telemetry badges: top count per metric (ties share the badge).
  const counts = new Map<string, Map<string, number>>();
  for (const event of input.telemetry) {
    if (!BADGE_BY_TELEMETRY_TYPE[event.type]) continue;
    const byDriver = counts.get(event.type) ?? new Map<string, number>();
    byDriver.set(event.driverId, (byDriver.get(event.driverId) ?? 0) + 1);
    counts.set(event.type, byDriver);
  }
  for (const [type, byDriver] of counts) {
    const badgeId = BADGE_BY_TELEMETRY_TYPE[type]!;
    const top = Math.max(...byDriver.values());
    if (top <= 0) continue;
    for (const [driverId, n] of byDriver) {
      if (n === top) winners.push({ badgeId, driverId });
    }
  }

  // Result badges: pole converter + clean sweep (pole, win and driver of the day).
  for (const r of input.results) {
    if (r.gridPosition === 1 && r.position === 1) {
      winners.push({ badgeId: 'pole_converter', driverId: r.driverId });
      if (r.driverOfTheDay) winners.push({ badgeId: 'clean_sweep', driverId: r.driverId });
    }
  }

  // Comeback king: largest positive grid -> finish gain (ties share the badge).
  let bestGain = 0;
  for (const r of input.results) bestGain = Math.max(bestGain, r.gridPosition - r.position);
  if (bestGain >= 1) {
    for (const r of input.results) {
      if (r.gridPosition - r.position === bestGain) {
        winners.push({ badgeId: 'comeback_king', driverId: r.driverId });
      }
    }
  }

  return winners;
}
