import {
  BreakdownStatRow,
  Car,
  CarStatRow,
  Championship,
  ChampionshipProgression,
  CompletePlannedRaceRequest,
  CreateChampionshipRequest,
  Driver,
  DriverStatRow,
  GlobalChampionRow,
  HeadToHeadRow,
  LogStandaloneRaceRequest,
  PlannedRoundInput,
  Race,
  RaceResult,
  ResultHistoryRow,
  SeriesChampionRow,
  StandingRow,
  TitleWin,
  Track,
  TrackDriverHistoryRow,
} from '../models/domain.models';
import { StorageMode } from './storage-mode';

export interface CarsRepository {
  list(): Promise<Car[]>;
  getById(id: string): Promise<Car | null>;
  create(input: Omit<Car, 'id'>): Promise<Car>;
  update(id: string, input: Omit<Car, 'id'>): Promise<Car>;
  remove(id: string): Promise<void>;
}

export interface DriversRepository {
  list(): Promise<Driver[]>;
  getById(id: string): Promise<Driver | null>;
  create(input: Omit<Driver, 'id'>): Promise<Driver>;
  update(id: string, input: Omit<Driver, 'id'>): Promise<Driver>;
  remove(id: string): Promise<void>;
}

export interface TracksRepository {
  list(): Promise<Track[]>;
  getById(id: string): Promise<Track | null>;
  create(input: Omit<Track, 'id'>): Promise<Track>;
  update(id: string, input: Omit<Track, 'id'>): Promise<Track>;
  remove(id: string): Promise<void>;
}

export type ChampionshipUpdateInput = Omit<
  Championship,
  'id' | 'seriesId' | 'editionNumber' | 'finishedAt'
> & { seriesId?: string; editionNumber?: number };

export interface ChampionshipsRepository {
  list(): Promise<Championship[]>;
  listActive(): Promise<Championship[]>;
  getById(id: string): Promise<Championship | null>;
  createWithCalendar(input: CreateChampionshipRequest): Promise<Championship>;
  update(id: string, input: ChampionshipUpdateInput): Promise<Championship>;
  remove(id: string): Promise<void>;
  finalizeChampionship(id: string): Promise<Championship>;
  listBySeries(seriesId: string): Promise<Championship[]>;
  listRaces(championshipId: string): Promise<Race[]>;
  listPlannedRaces(championshipId: string): Promise<Race[]>;
  updatePlannedRaceTrack(
    raceId: string,
    trackId: string | null
  ): Promise<Race>;
  addPlannedRounds(
    championshipId: string,
    rounds: PlannedRoundInput[]
  ): Promise<void>;
  getStandings(championshipId: string): Promise<StandingRow[]>;
  getProgression(championshipId: string): Promise<ChampionshipProgression>;
  listResultsByRaceIds(raceIds: string[]): Promise<Map<string, RaceResult[]>>;
  getOverallStandings(): Promise<StandingRow[]>;
  getSeriesChampions(seriesId: string): Promise<SeriesChampionRow[]>;
  getGlobalChampionsHall(): Promise<GlobalChampionRow[]>;
  getDriverTitles(driverId: string): Promise<TitleWin[]>;
  getCarTitles(carId: string): Promise<TitleWin[]>;
  applyTitleFight(
    standings: StandingRow[],
    pointSystem: number[],
    remainingPlanned: number
  ): StandingRow[];
}

export interface RacesRepository {
  listRecent(limit?: number): Promise<Race[]>;
  getRace(id: string): Promise<Race | null>;
  listResultsByRace(raceId: string): Promise<RaceResult[]>;
  completePlannedRace(request: CompletePlannedRaceRequest): Promise<Race>;
  logStandaloneRace(request: LogStandaloneRaceRequest): Promise<Race>;
  cancelRace(raceId: string): Promise<Race>;
  getDriverStats(): Promise<DriverStatRow[]>;
  getCarStats(): Promise<CarStatRow[]>;
  getDriverResultHistory(driverId: string): Promise<ResultHistoryRow[]>;
  getCarResultHistory(carId: string): Promise<ResultHistoryRow[]>;
  getDriverBreakdownByCar(driverId: string): Promise<BreakdownStatRow[]>;
  getDriverBreakdownByTrack(driverId: string): Promise<BreakdownStatRow[]>;
  getCarBreakdownByDriver(carId: string): Promise<BreakdownStatRow[]>;
  getCarBreakdownByTrack(carId: string): Promise<BreakdownStatRow[]>;
  getTrackDriverHistory(trackId: string): Promise<TrackDriverHistoryRow[]>;
  getDriverHeadToHead(driverId: string): Promise<HeadToHeadRow[]>;
  getDriverBestFinish(
    driverId: string
  ): Promise<{ position: number; racedAt?: string; trackName?: string } | null>;
  pointsForPosition(
    pointSystem: number[],
    position: number,
    dnf: boolean
  ): number;
  validateResults(
    results: {
      driverId: string;
      carId: string;
      gridPosition: number;
      position: number;
    }[]
  ): void;
}

export interface DataProvider {
  readonly mode: StorageMode;
  readonly cars: CarsRepository;
  readonly drivers: DriversRepository;
  readonly tracks: TracksRepository;
  readonly championships: ChampionshipsRepository;
  readonly races: RacesRepository;
  /** Preview-only: wipe demo state and reseed. No-op elsewhere. */
  resetPreview?(): void;
}
