// --- BYOS & Session Types ---
export interface SupabaseConfig {
  url: string;
  anonKey: string;
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
  colorHex: string;
}

export interface Driver {
  id: string;
  name: string;
  abbreviation: string;
  number: number;
  isLegend: boolean;
  fixedCarId?: string;
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
  pointSystem: number[];
  useGarage: boolean;
  useWeather: boolean;
  useLegends: boolean;
  useHeavyRain: boolean;
  isActive: boolean;
}

export interface Race {
  id: string;
  championshipId?: string;
  trackId: string;
  roundNumber?: number;
  raceType: 'championship' | 'standalone';
  weatherCondition?: string;
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

export interface LogRaceRequest {
  championshipId?: string;
  trackId: string;
  raceType: 'championship' | 'standalone';
  weatherCondition?: string;
  roundNumber?: number;
  results: RaceResultPayload[];
}

export interface StandingRow {
  driverId: string;
  driverName: string;
  abbreviation: string;
  number: number;
  points: number;
  wins: number;
  podiums: number;
  races: number;
}

export interface DriverStatRow {
  driverId: string;
  driverName: string;
  abbreviation: string;
  number: number;
  races: number;
  wins: number;
  podiums: number;
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
