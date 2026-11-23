import { StorageMode } from '../data/storage-mode';

// --- BYOS & Session Types ---
export interface SupabaseConfig {
  url: string;
  /** Prefer publishable key (`sb_publishable_…`). Legacy anon JWTs still accepted. */
  publishableKey: string;
}

export interface LocalAuthSession {
  apiBaseUrl: string;
  token: string;
}

export interface UserSession {
  /** Active data backend; defaults to supabase for legacy sessions. */
  storageMode?: StorageMode;
  config: SupabaseConfig;
  /** Present when storageMode is `local`. */
  localAuth?: LocalAuthSession;
  user: {
    id: string;
    username: string;
    role: 'guest' | 'host' | 'admin';
  } | null;
  expiresAt: number;
}

/** Placeholder config stored for preview-mode sessions (no network). */
export const PREVIEW_SESSION_CONFIG: SupabaseConfig = {
  url: 'preview://local',
  publishableKey: 'preview',
};

/** Placeholder config stored for local API sessions. */
export const LOCAL_SESSION_CONFIG: SupabaseConfig = {
  url: 'local://api',
  publishableKey: 'local',
};

// --- Domain Models ---
export interface Car {
  id: string;
  name: string;
  /** Named color key (red, blue, …) — unique across cars. */
  colorKey: string;
  colorHex: string;
}

export interface Association {
  id: string;
  name: string;
  abbreviation: string;
}

export interface ScoringSystem {
  id: string;
  name: string;
  points: number[];
  bonusFastestLap: number;
  bonusPole: number;
  bonusDriverOfDay: number;
  isBuiltin: boolean;
}

export type GarageUpgradeCategory =
  | 'engine'
  | 'suspension'
  | 'brakes'
  | 'tires'
  | 'cooling'
  | 'other';

export interface GarageUpgrade {
  id: string;
  name: string;
  category: GarageUpgradeCategory;
  heatCost: number;
  effect: string;
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

export interface TrackCorner {
  order: number;
  name: string;
  maxSpeed: number;
}

export interface Track {
  id: string;
  name: string;
  country: string;
  lengthSpaces?: number;
  laps?: number;
  corners?: TrackCorner[];
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
  associationId?: string;
  scoringSystemId?: string;
}

export type RaceStage = 'pre_race' | 'in_race' | 'post_race';
export type RaceStatus =
  | 'planned'
  | 'pre_race'
  | 'in_race'
  | 'post_race'
  | 'completed'
  | 'cancelled';

export type TelemetryEventType =
  | 'fastest_turn'
  | 'slipstream_overtake'
  | 'corner_speed_ok'
  | 'corner_spin';

export interface TelemetryEvent {
  id: string;
  driverId: string;
  type: TelemetryEventType;
  cornerOrder?: number;
  note?: string;
  createdAt?: string;
}

export interface RaceEntry {
  driverId: string;
  carId: string;
  gridPosition: number;
  loadout: string[];
}

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
  name?: string;
  abbreviation?: string;
  associationId?: string;
  scoringSystemId?: string;
  reverseDirection?: boolean;
  stage?: RaceStage;
  telemetry?: TelemetryEvent[];
  entries?: RaceEntry[];
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
  gapTurns?: number;
  driverOfTheDay?: boolean;
  loadout?: string[];
}

export interface RaceResultPayload {
  driverId: string;
  carId: string;
  gridPosition: number;
  position: number;
  pointsAwarded: number;
  dnf: boolean;
  gapTurns?: number;
  driverOfTheDay?: boolean;
  loadout?: string[];
}

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  metric: string;
}

export interface BadgeAward {
  id: string;
  badgeId: string;
  driverId: string;
  raceId?: string;
  associationId?: string;
  awardedAt: string;
}

export interface SavePreRaceRequest {
  raceId?: string;
  championshipId?: string;
  associationId?: string;
  trackId: string;
  reverseDirection: boolean;
  name: string;
  abbreviation: string;
  scoringSystemId?: string;
  weatherCondition?: string;
  trackCondition?: string;
  racedAt?: string;
  useGarage: boolean;
  entries: RaceEntry[];
}

export interface SaveTelemetryRequest {
  raceId: string;
  telemetry: TelemetryEvent[];
}

export interface CompletePostRaceRequest {
  raceId: string;
  results: Array<
    RaceResultPayload & {
      gapTurns: number;
      driverOfTheDay: boolean;
      loadout?: string[];
    }
  >;
}

export interface PlannedRoundInput {
  roundNumber: number;
  trackId?: string;
}

export interface CreateChampionshipRequest {
  name: string;
  season: string;
  associationId?: string;
  scoringSystemId?: string;
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

/** Cumulative standings after each completed championship round. */
export interface ProgressionRound {
  raceId: string;
  roundNumber: number;
  trackId?: string;
}

export interface ProgressionDriverSeries {
  driverId: string;
  driverName: string;
  nickname?: string;
  abbreviation: string;
  number: number;
  /** Most-used car color in this championship (fallback palette if unknown). */
  color: string;
  /** Cumulative points after each completed round (same order as rounds). */
  pointsAfterRound: number[];
  /** Race finish position per completed round; null if the driver did not take part. */
  finishPositionByRound: Array<number | null>;
  /** DNF flag aligned with finishPositionByRound. */
  dnfByRound: boolean[];
}

export interface ChampionshipProgression {
  rounds: ProgressionRound[];
  series: ProgressionDriverSeries[];
}

export interface RaceResultDetailRow {
  driverId: string;
  driverName: string;
  nickname?: string;
  carId: string;
  carName: string;
  carColorHex?: string;
  gridPosition: number;
  position: number;
  pointsAwarded: number;
  dnf: boolean;
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
