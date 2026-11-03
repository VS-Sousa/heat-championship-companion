import {
  Car,
  Championship,
  Driver,
  Race,
  RaceResult,
  Track,
} from '../models/domain.models';

export function mapCar(row: Record<string, unknown>): Car {
  return {
    id: String(row['id']),
    name: String(row['name']),
    colorHex: String(row['color_hex']),
  };
}

export function mapDriver(row: Record<string, unknown>): Driver {
  return {
    id: String(row['id']),
    name: String(row['name']),
    abbreviation: String(row['abbreviation']),
    number: Number(row['number']),
    isLegend: Boolean(row['is_legend']),
    fixedCarId: row['fixed_car_id']
      ? String(row['fixed_car_id'])
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
    pointSystem: points.map(Number),
    useGarage: Boolean(row['use_garage']),
    useWeather: Boolean(row['use_weather']),
    useLegends: Boolean(row['use_legends']),
    useHeavyRain: Boolean(row['use_heavy_rain']),
    isActive: Boolean(row['is_active']),
  };
}

export function mapRace(row: Record<string, unknown>): Race {
  return {
    id: String(row['id']),
    championshipId: row['championship_id']
      ? String(row['championship_id'])
      : undefined,
    trackId: String(row['track_id']),
    roundNumber:
      row['round_number'] !== null && row['round_number'] !== undefined
        ? Number(row['round_number'])
        : undefined,
    raceType: (row['race_type'] as Race['raceType']) ?? 'championship',
    weatherCondition: row['weather_condition']
      ? String(row['weather_condition'])
      : undefined,
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
