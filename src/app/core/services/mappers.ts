import {
  Car,
  Championship,
  Driver,
  Race,
  RaceResult,
  Track,
} from '../models/domain.models';
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
  };
}
