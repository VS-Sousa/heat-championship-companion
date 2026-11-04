// --- BYOS & Session Types ---
export interface SupabaseConfig {
  url: string;
  /** Prefer publishable key (`sb_publishable_…`). Legacy anon JWTs still accepted. */
  publishableKey: string;
}

export interface UserSession {
  config: SupabaseConfig;
  user: {
    id: string;
    username: string;
    role: 'guest' | 'host' | 'admin';
  } | null;
  expiresAt: number;
}

// --- Domain Models ---
export interface Car {
  id: string;
  name: string;
  /** Named color key (red, blue, …) — unique across cars. */
  colorKey: string;
  colorHex: string;
}

export interface Driver {
  id: string;
  name: string;
  nickname?: string;
  abbreviation: string;
  number: number;
  isLegend: boolean;
  fixedCarId?: string;
  /** Default car when logging a race (non-legend or when not locked). */
  favoriteCarId?: string;
  userId?: string;
}

export interface Track {
  id: string;
  name: string;
  country: string;
}

export interface Championship {
  id: string;
  name: string;
  season: string;
  seriesId: string;
  editionNumber: number;
  pointSystem: number[];
  useGarage: boolean;
  useEvents: boolean;
  usePress: boolean;
  useSponsorship: boolean;
  isActive: boolean;
  finishedAt?: string;
}

export type RaceStatus = 'planned' | 'completed' | 'cancelled';

export interface Race {
  id: string;
  championshipId?: string;
  trackId?: string;
  roundNumber?: number;
  raceType: 'championship' | 'standalone';
  status: RaceStatus;
  weatherCondition?: string;
  trackCondition?: string;
  racedAt?: string;
  createdAt?: string;
}

export interface RaceResult {
  id: string;
  raceId: string;
  driverId: string;
  carId: string;
  gridPosition: number;
  position: number;
  pointsAwarded: number;
  dnf: boolean;
}

export interface RaceResultPayload {
  driverId: string;
  carId: string;
  gridPosition: number;
  position: number;
  pointsAwarded: number;
  dnf: boolean;
}

export interface PlannedRoundInput {
  roundNumber: number;
  trackId?: string;
}

export interface CreateChampionshipRequest {
  name: string;
  season: string;
  pointSystem: number[];
  useGarage: boolean;
  useEvents: boolean;
  usePress: boolean;
  useSponsorship: boolean;
  /** Inherit series from this championship (next edition). */
  successionOfId?: string;
  calendar: PlannedRoundInput[];
}

export interface CompletePlannedRaceRequest {
  raceId: string;
  trackId: string;
  weatherCondition?: string;
  trackCondition?: string;
  racedAt: string;
  results: RaceResultPayload[];
}

export interface LogStandaloneRaceRequest {
  trackId: string;
  weatherCondition?: string;
  trackCondition?: string;
  racedAt: string;
  results: RaceResultPayload[];
}

/** @deprecated Prefer completePlannedRace / logStandaloneRace */
export interface LogRaceRequest {
  championshipId?: string;
  trackId: string;
  raceType: 'championship' | 'standalone';
  weatherCondition?: string;
  trackCondition?: string;
  roundNumber?: number;
  racedAt?: string;
  results: RaceResultPayload[];
}

export interface StandingRow {
  driverId: string;
  driverName: string;
  nickname?: string;
  abbreviation: string;
  number: number;
  points: number;
  wins: number;
  podiums: number;
  races: number;
  inTitleFight?: boolean;
}

export interface DriverStatRow {
  driverId: string;
  driverName: string;
  nickname?: string;
  abbreviation: string;
  number: number;
  isLegend: boolean;
  races: number;
  wins: number;
  podiums: number;
  points: number;
  dnfs: number;
  avgFinish: number | null;
}

export interface CarStatRow {
  carId: string;
  carName: string;
  colorHex: string;
  races: number;
  wins: number;
  podiums: number;
  dnfs: number;
}

export interface SeriesChampionRow {
  championshipId: string;
  championshipName: string;
  season: string;
  editionNumber: number;
  finishedAt?: string;
  driverId?: string;
  driverName?: string;
  nickname?: string;
  carId?: string;
  carName?: string;
  carColorHex?: string;
  points?: number;
}

export interface GlobalChampionRow {
  driverId: string;
  driverName: string;
  nickname?: string;
  abbreviation: string;
  number: number;
  isLegend: boolean;
  titles: number;
  lastTitleSeason?: string;
  lastTitleCarName?: string;
}

export interface TitleWin {
  championshipId: string;
  championshipName: string;
  season: string;
  editionNumber: number;
  carId?: string;
  carName?: string;
  driverId?: string;
  driverName?: string;
}

export interface ResultHistoryRow {
  raceId: string;
  racedAt?: string;
  trackId?: string;
  trackName?: string;
  championshipId?: string;
  championshipName?: string;
  driverId: string;
  driverName: string;
  carId: string;
  carName: string;
  carColorHex?: string;
  gridPosition: number;
  position: number;
  pointsAwarded: number;
  dnf: boolean;
}

export interface HeadToHeadRow {
  opponentId: string;
  opponentName: string;
  wins: number;
  losses: number;
  draws: number;
}

export interface BreakdownStatRow {
  id: string;
  label: string;
  colorHex?: string;
  races: number;
  wins: number;
  podiums: number;
  points: number;
  avgFinish: number | null;
  bestFinish: number | null;
}

export interface TrackDriverHistoryRow {
  driverId: string;
  driverName: string;
  nickname?: string;
  races: number;
  wins: number;
  podiums: number;
  avgFinish: number | null;
  bestFinish: number | null;
}
