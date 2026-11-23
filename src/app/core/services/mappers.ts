import {
  Association,
  BadgeAward,
  BadgeDefinition,
  Car,
  Championship,
  Driver,
  GarageUpgrade,
  Race,
  RaceEntry,
  RaceResult,
  ScoringSystem,
  TelemetryEvent,
  Track,
  TrackCorner,
} from '../models/domain.models';

function parseArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function mapTrackCorner(value: unknown): TrackCorner {
  const corner = asRecord(value);
  return {
    order: Number(corner['order']),
    name: String(corner['name']),
    maxSpeed: Number(corner['maxSpeed'] ?? corner['max_speed']),
  };
}

function mapTelemetryEvent(value: unknown): TelemetryEvent {
  const event = asRecord(value);
  return {
    id: String(event['id']),
    driverId: String(event['driverId'] ?? event['driver_id']),
    type: event['type'] as TelemetryEvent['type'],
    cornerOrder:
      event['cornerOrder'] !== null && event['cornerOrder'] !== undefined
        ? Number(event['cornerOrder'])
        : event['corner_order'] !== null && event['corner_order'] !== undefined
          ? Number(event['corner_order'])
          : undefined,
    note: event['note'] ? String(event['note']) : undefined,
    createdAt: event['createdAt']
      ? String(event['createdAt'])
      : event['created_at']
        ? String(event['created_at'])
        : undefined,
  };
}

function mapRaceEntry(value: unknown): RaceEntry {
  const entry = asRecord(value);
  return {
    driverId: String(entry['driverId'] ?? entry['driver_id']),
    carId: String(entry['carId'] ?? entry['car_id']),
    gridPosition: Number(entry['gridPosition'] ?? entry['grid_position']),
    loadout: parseArray(entry['loadout']).map(String),
  };
}

export function mapAssociation(row: Record<string, unknown>): Association {
  return {
    id: String(row['id']),
    name: String(row['name']),
    abbreviation: String(row['abbreviation']),
  };
}

export function mapScoringSystem(
  row: Record<string, unknown>,
): ScoringSystem {
  return {
    id: String(row['id']),
    name: String(row['name']),
    points: parseArray(row['points']).map(Number),
    bonusFastestLap: Number(row['bonus_fastest_lap'] ?? 0),
    bonusPole: Number(row['bonus_pole'] ?? 0),
    bonusDriverOfDay: Number(row['bonus_driver_of_day'] ?? 0),
    isBuiltin: Boolean(row['is_builtin']),
  };
}

export function mapGarageUpgrade(
  row: Record<string, unknown>,
): GarageUpgrade {
  return {
    id: String(row['id']),
    name: String(row['name']),
    category: row['category'] as GarageUpgrade['category'],
    heatCost: Number(row['heat_cost'] ?? 0),
    effect: String(row['effect'] ?? ''),
  };
}

export function mapBadgeDefinition(
  row: Record<string, unknown>,
): BadgeDefinition {
  return {
    id: String(row['id']),
    name: String(row['name']),
    description: String(row['description']),
    metric: String(row['metric']),
  };
}

export function mapBadgeAward(row: Record<string, unknown>): BadgeAward {
  return {
    id: String(row['id']),
    badgeId: String(row['badge_id']),
    driverId: String(row['driver_id']),
    raceId: row['race_id'] ? String(row['race_id']) : undefined,
    associationId: row['association_id']
      ? String(row['association_id'])
      : undefined,
    awardedAt: String(row['awarded_at']),
  };
}

export function mapCar(row: Record<string, unknown>): Car {
  const colorHex = String(row['color_hex'] ?? '#E1221C');
  return {
    id: String(row['id']),
    name: String(row['name']),
    colorKey: row['color_key']
      ? String(row['color_key'])
      : colorHex.toLowerCase(),
    colorHex,
  };
}

export function mapDriver(row: Record<string, unknown>): Driver {
  return {
    id: String(row['id']),
    name: String(row['name']),
    nickname: row['nickname'] ? String(row['nickname']) : undefined,
    abbreviation: String(row['abbreviation']),
    number: Number(row['number']),
    isLegend: Boolean(row['is_legend']),
    fixedCarId: row['fixed_car_id']
      ? String(row['fixed_car_id'])
      : undefined,
    favoriteCarId: row['favorite_car_id']
      ? String(row['favorite_car_id'])
      : undefined,
    userId: row['user_id'] ? String(row['user_id']) : undefined,
  };
}

export function mapTrack(row: Record<string, unknown>): Track {
  return {
    id: String(row['id']),
    name: String(row['name']),
    country: String(row['country']),
    lengthSpaces:
      row['length_spaces'] !== null && row['length_spaces'] !== undefined
        ? Number(row['length_spaces'])
        : undefined,
    laps:
      row['laps'] !== null && row['laps'] !== undefined
        ? Number(row['laps'])
        : undefined,
    corners: parseArray(row['corners']).map(mapTrackCorner),
  };
}

export function mapChampionship(row: Record<string, unknown>): Championship {
  const points = Array.isArray(row['point_system'])
    ? (row['point_system'] as number[])
    : [];
  return {
    id: String(row['id']),
    name: String(row['name']),
    season: String(row['season']),
    seriesId: String(row['series_id']),
    editionNumber: Number(row['edition_number'] ?? 1),
    pointSystem: points.map(Number),
    useGarage: Boolean(row['use_garage']),
    useEvents: Boolean(row['use_events']),
    usePress: Boolean(row['use_press']),
    useSponsorship: Boolean(row['use_sponsorship']),
    isActive: Boolean(row['is_active']),
    finishedAt: row['finished_at'] ? String(row['finished_at']) : undefined,
    associationId: row['association_id']
      ? String(row['association_id'])
      : undefined,
    scoringSystemId: row['scoring_system_id']
      ? String(row['scoring_system_id'])
      : undefined,
  };
}

export function mapRace(row: Record<string, unknown>): Race {
  return {
    id: String(row['id']),
    championshipId: row['championship_id']
      ? String(row['championship_id'])
      : undefined,
    trackId: row['track_id'] ? String(row['track_id']) : undefined,
    roundNumber:
      row['round_number'] !== null && row['round_number'] !== undefined
        ? Number(row['round_number'])
        : undefined,
    raceType: (row['race_type'] as Race['raceType']) ?? 'championship',
    status: (row['status'] as Race['status']) ?? 'completed',
    weatherCondition: row['weather_condition']
      ? String(row['weather_condition'])
      : undefined,
    trackCondition: row['track_condition']
      ? String(row['track_condition'])
      : undefined,
    racedAt: row['raced_at'] ? String(row['raced_at']) : undefined,
    createdAt: row['created_at'] ? String(row['created_at']) : undefined,
    name: row['name'] ? String(row['name']) : undefined,
    abbreviation: row['abbreviation']
      ? String(row['abbreviation'])
      : undefined,
    associationId: row['association_id']
      ? String(row['association_id'])
      : undefined,
    scoringSystemId: row['scoring_system_id']
      ? String(row['scoring_system_id'])
      : undefined,
    reverseDirection:
      row['reverse_direction'] !== null &&
      row['reverse_direction'] !== undefined
        ? Boolean(row['reverse_direction'])
        : undefined,
    stage: row['stage'] ? (row['stage'] as Race['stage']) : undefined,
    telemetry: parseArray(row['telemetry']).map(mapTelemetryEvent),
    entries: parseArray(row['entries']).map(mapRaceEntry),
  };
}

export function mapRaceResult(row: Record<string, unknown>): RaceResult {
  return {
    id: String(row['id']),
    raceId: String(row['race_id']),
    driverId: String(row['driver_id']),
    carId: String(row['car_id']),
    gridPosition: Number(row['grid_position']),
    position: Number(row['position']),
    pointsAwarded: Number(row['points_awarded'] ?? 0),
    dnf: Boolean(row['dnf']),
    gapTurns:
      row['gap_turns'] !== null && row['gap_turns'] !== undefined
        ? Number(row['gap_turns'])
        : undefined,
    driverOfTheDay:
      row['driver_of_the_day'] !== null &&
      row['driver_of_the_day'] !== undefined
        ? Boolean(row['driver_of_the_day'])
        : undefined,
    loadout: parseArray(row['loadout']).map(String),
  };
}
