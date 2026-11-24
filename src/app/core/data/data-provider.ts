import {
  Association,
  BadgeAward,
  BadgeDefinition,
  BreakdownStatRow,
  Car,
  CarStatRow,
  Championship,
  ChampionshipEntry,
  ChampionshipProgression,
  CompletePlannedRaceRequest,
  CompletePostRaceRequest,
  ConstructorStandingRow,
  CreateChampionshipRequest,
  Driver,
  DriverStatRow,
  GarageUpgrade,
  GlobalChampionRow,
  HeadToHeadRow,
  LogStandaloneRaceRequest,
  PlannedRoundInput,
  Race,
  RaceResult,
  ResultHistoryRow,
  SavePreRaceRequest,
  SaveTelemetryRequest,
  ScoringSystem,
  SeriesChampionRow,
  StandingRow,
  TitleWin,
  Track,
  TrackDriverHistoryRow,
} from '../models/domain.models';
import { StorageMode } from './storage-mode';

export type ChampionshipEntryInput = Omit<
  ChampionshipEntry,
  'id' | 'championshipId' | 'garageUpgradeIds'
> & { garageUpgradeIds?: string[] };

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

export interface AssociationsRepository {
  list(): Promise<Association[]>;
  getById(id: string): Promise<Association | null>;
  create(input: Omit<Association, 'id'>): Promise<Association>;
  update(id: string, input: Omit<Association, 'id'>): Promise<Association>;
  remove(id: string): Promise<void>;
  listMemberIds(associationId: string): Promise<string[]>;
  setMembers(associationId: string, driverIds: string[]): Promise<void>;
}

export interface ScoringSystemsRepository {
  list(): Promise<ScoringSystem[]>;
  getById(id: string): Promise<ScoringSystem | null>;
  create(
    input: Omit<ScoringSystem, 'id' | 'isBuiltin'>
  ): Promise<ScoringSystem>;
  update(
    id: string,
    input: Omit<ScoringSystem, 'id' | 'isBuiltin'>
  ): Promise<ScoringSystem>;
  remove(id: string): Promise<void>;
}

export interface GarageUpgradesRepository {
  list(): Promise<GarageUpgrade[]>;
  getById(id: string): Promise<GarageUpgrade | null>;
  create(input: Omit<GarageUpgrade, 'id'>): Promise<GarageUpgrade>;
  update(id: string, input: Omit<GarageUpgrade, 'id'>): Promise<GarageUpgrade>;
  remove(id: string): Promise<void>;
}

export interface BadgesRepository {
  listDefinitions(): Promise<BadgeDefinition[]>;
  listAwards(filters?: {
    driverId?: string;
    raceId?: string;
    associationId?: string;
  }): Promise<BadgeAward[]>;
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
  getConstructorStandings(
    championshipId: string
  ): Promise<ConstructorStandingRow[]>;
  computeTitleFight(championshipId: string): Promise<StandingRow[]>;
  getProgression(championshipId: string): Promise<ChampionshipProgression>;
  listResultsByRaceIds(raceIds: string[]): Promise<Map<string, RaceResult[]>>;
  getOverallStandings(): Promise<StandingRow[]>;
  getSeriesChampions(seriesId: string): Promise<SeriesChampionRow[]>;
  getGlobalChampionsHall(): Promise<GlobalChampionRow[]>;
  getDriverTitles(driverId: string): Promise<TitleWin[]>;
  getCarTitles(carId: string): Promise<TitleWin[]>;
  listCars(championshipId: string): Promise<string[]>;
  listEntries(championshipId: string): Promise<ChampionshipEntry[]>;
  upsertEntry(
    championshipId: string,
    input: ChampionshipEntryInput
  ): Promise<ChampionshipEntry>;
  removeEntry(championshipId: string, entryId: string): Promise<void>;
  setEntryUpgrades(
    championshipId: string,
    entryId: string,
    garageUpgradeIds: string[]
  ): Promise<ChampionshipEntry>;
  getPreviousSeriesChampionDriverId(
    seriesId: string,
    beforeEditionNumber: number
  ): Promise<string | null>;
}

export interface RacesRepository {
  listRecent(limit?: number): Promise<Race[]>;
  getRace(id: string): Promise<Race | null>;
  listResultsByRace(raceId: string): Promise<RaceResult[]>;
  completePlannedRace(request: CompletePlannedRaceRequest): Promise<Race>;
  logStandaloneRace(request: LogStandaloneRaceRequest): Promise<Race>;
  cancelRace(raceId: string): Promise<Race>;
  /** Stage 1: persist setup/grid and move race to pre_race (or create standalone). */
  savePreRace(request: SavePreRaceRequest): Promise<Race>;
  /** Advance pre_race → in_race. */
  startLive(raceId: string): Promise<Race>;
  /** Stage 2: persist live telemetry events. */
  saveTelemetry(request: SaveTelemetryRequest): Promise<Race>;
  /** Advance in_race → post_race. */
  openPodium(raceId: string): Promise<Race>;
  /** Stage 3: final results + badges, mark completed. */
  completePostRace(request: CompletePostRaceRequest): Promise<Race>;
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
  pointsForPosition(pointSystem: number[], position: number): number;
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
  readonly associations: AssociationsRepository;
  readonly scoringSystems: ScoringSystemsRepository;
  readonly garageUpgrades: GarageUpgradesRepository;
  readonly badges: BadgesRepository;
  readonly championships: ChampionshipsRepository;
  readonly races: RacesRepository;
  /** Preview-only: wipe demo state and reseed. No-op elsewhere. */
  resetPreview?(): void;
}
