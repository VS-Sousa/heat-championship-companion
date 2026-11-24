export type Row = Record<string, unknown>;

const optional = (value: unknown) =>
  value === null || value === undefined ? undefined : String(value);

export const mapCar = (r: Row) => ({
  id: String(r.id), name: String(r.name), colorKey: String(r.color_key),
  colorHex: String(r.color_hex),
});
export const mapDriver = (r: Row) => ({
  id: String(r.id), name: String(r.name), nickname: optional(r.nickname),
  isLegend: Boolean(r.is_legend), fixedCarId: optional(r.fixed_car_id),
  favoriteCarId: optional(r.favorite_car_id), userId: optional(r.user_id),
});
export const mapAssociation = (r: Row) => ({
  id: String(r.id), name: String(r.name),
});
export const mapChampionshipEntry = (r: Row, garageUpgradeIds: string[] = []) => ({
  id: String(r.id),
  championshipId: String(r.championship_id),
  driverId: String(r.driver_id),
  carId: String(r.car_id),
  number: Number(r.number),
  abbreviation: String(r.abbreviation),
  garageUpgradeIds,
});
export const mapGarageUpgrade = (r: Row) => ({
  id: String(r.id), name: String(r.name), description: String(r.description ?? ''),
  set: String(r.set ?? 'basegame'),
});
export const mapTrack = (r: Row) => ({
  id: String(r.id), name: String(r.name), country: String(r.country),
  lengthSpaces: r.length_spaces == null ? undefined : Number(r.length_spaces),
  laps: r.laps == null ? undefined : Number(r.laps), corners: r.corners ?? [],
});
export const mapChampionship = (r: Row) => ({
  id: String(r.id), name: String(r.name), season: String(r.season),
  seriesId: String(r.series_id), editionNumber: Number(r.edition_number),
  pointSystem: (r.point_system as unknown[]).map(Number),
  useGarage: Boolean(r.use_garage), useEvents: Boolean(r.use_events),
  usePress: Boolean(r.use_press), useSponsorship: Boolean(r.use_sponsorship),
  isActive: Boolean(r.is_active), finishedAt: optional(r.finished_at),
  scoringSystemId: String(r.scoring_system_id),
});
export const mapRace = (r: Row) => ({
  id: String(r.id), championshipId: optional(r.championship_id),
  trackId: optional(r.track_id),
  roundNumber: r.round_number == null ? undefined : Number(r.round_number),
  raceType: String(r.race_type), status: String(r.status),
  weatherCondition: optional(r.weather_condition),
  trackCondition: optional(r.track_condition), racedAt: optional(r.raced_at),
  createdAt: optional(r.created_at),
  name: optional(r.name), abbreviation: optional(r.abbreviation),
  associationId: optional(r.association_id), scoringSystemId: optional(r.scoring_system_id),
  reverseDirection: r.reverse_direction == null ? undefined : Boolean(r.reverse_direction),
  stage: optional(r.stage), telemetry: r.telemetry ?? [], entries: r.entries ?? [],
});
export const mapRaceResult = (r: Row) => ({
  id: String(r.id), raceId: String(r.race_id), driverId: String(r.driver_id),
  carId: String(r.car_id), gridPosition: Number(r.grid_position),
  position: Number(r.position), pointsAwarded: Number(r.points_awarded),
  gapTurns: r.gap_turns == null ? undefined : Number(r.gap_turns),
  driverOfTheDay: r.driver_of_the_day == null ? undefined : Boolean(r.driver_of_the_day),
  loadout: r.loadout ?? [],
});

export const formatDriverName = (driver: { name: string; nickname?: string }) =>
  driver.nickname ? `${driver.name} "${driver.nickname}"` : driver.name;
