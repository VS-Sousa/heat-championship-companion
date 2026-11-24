import { HttpClient } from '@angular/common/http';
import {
  BreakdownStatRow,
  Association,
  BadgeAward,
  BadgeDefinition,
  Car,
  CarStatRow,
  Championship,
  ChampionshipEntry,
  ChampionshipProgression,
  CompletePlannedRaceRequest,
  ConstructorStandingRow,
  CreateChampionshipRequest,
  CompletePostRaceRequest,
  Driver,
  DriverStatRow,
  GarageUpgrade,
  GlobalChampionRow,
  HeadToHeadRow,
  LogStandaloneRaceRequest,
  PlannedRoundInput,
  Race,
  RaceResult,
  SavePreRaceRequest,
  SaveTelemetryRequest,
  ScoringSystem,
  ResultHistoryRow,
  SeriesChampionRow,
  StandingRow,
  TitleWin,
  Track,
  TrackDriverHistoryRow,
} from '../../../models/domain.models';
import { SessionService } from '../../../services/session.service';
import {
  CarsRepository,
  AssociationsRepository,
  BadgesRepository,
  ChampionshipEntryInput,
  ChampionshipUpdateInput,
  ChampionshipsRepository,
  DataProvider,
  DriversRepository,
  GarageUpgradesRepository,
  RacesRepository,
  ScoringSystemsRepository,
  TracksRepository,
} from '../../data-provider';
import {
  pointsForPosition as sharedPoints,
  validateResults as sharedValidate,
} from '../../shared/race-rules';
import { normalizeHex } from '../../shared/normalize-hex';
import { StorageMode } from '../../storage-mode';
import { LocalApiClient } from './local-api.client';

class LocalCarsRepo implements CarsRepository {
  constructor(private readonly api: LocalApiClient) {}

  list(): Promise<Car[]> {
    return this.api.get<Car[]>('/cars');
  }

  getById(id: string): Promise<Car | null> {
    return this.api.getNullable<Car>(`/cars/${id}`);
  }

  create(input: Omit<Car, 'id'>): Promise<Car> {
    const colorHex = normalizeHex(input.colorHex);
    return this.api.post<Car>('/cars', {
      name: input.name,
      colorHex,
      colorKey: colorHex.toLowerCase(),
    });
  }

  update(id: string, input: Omit<Car, 'id'>): Promise<Car> {
    const colorHex = normalizeHex(input.colorHex);
    return this.api.put<Car>(`/cars/${id}`, {
      name: input.name,
      colorHex,
      colorKey: colorHex.toLowerCase(),
    });
  }

  remove(id: string): Promise<void> {
    return this.api.delete(`/cars/${id}`);
  }
}

class LocalDriversRepo implements DriversRepository {
  constructor(private readonly api: LocalApiClient) {}

  list(): Promise<Driver[]> {
    return this.api.get<Driver[]>('/drivers');
  }

  getById(id: string): Promise<Driver | null> {
    return this.api.getNullable<Driver>(`/drivers/${id}`);
  }

  create(input: Omit<Driver, 'id'>): Promise<Driver> {
    return this.api.post<Driver>('/drivers', input);
  }

  update(id: string, input: Omit<Driver, 'id'>): Promise<Driver> {
    return this.api.put<Driver>(`/drivers/${id}`, input);
  }

  remove(id: string): Promise<void> {
    return this.api.delete(`/drivers/${id}`);
  }
}

class LocalTracksRepo implements TracksRepository {
  constructor(private readonly api: LocalApiClient) {}

  list(): Promise<Track[]> {
    return this.api.get<Track[]>('/tracks');
  }

  getById(id: string): Promise<Track | null> {
    return this.api.getNullable<Track>(`/tracks/${id}`);
  }

  create(input: Omit<Track, 'id'>): Promise<Track> {
    return this.api.post<Track>('/tracks', input);
  }

  update(id: string, input: Omit<Track, 'id'>): Promise<Track> {
    return this.api.put<Track>(`/tracks/${id}`, input);
  }

  remove(id: string): Promise<void> {
    return this.api.delete(`/tracks/${id}`);
  }
}

class LocalAssociationsRepo implements AssociationsRepository {
  constructor(private readonly api: LocalApiClient) {}
  list(): Promise<Association[]> { return this.api.get('/associations'); }
  getById(id: string): Promise<Association | null> { return this.api.getNullable(`/associations/${id}`); }
  create(input: Omit<Association, 'id'>): Promise<Association> { return this.api.post('/associations', input); }
  update(id: string, input: Omit<Association, 'id'>): Promise<Association> { return this.api.put(`/associations/${id}`, input); }
  remove(id: string): Promise<void> { return this.api.delete(`/associations/${id}`); }
  listMemberIds(id: string): Promise<string[]> { return this.api.get(`/associations/${id}/members`); }
  setMembers(id: string, driverIds: string[]): Promise<void> { return this.api.put(`/associations/${id}/members`, { driverIds }); }
}
class LocalScoringSystemsRepo implements ScoringSystemsRepository {
  constructor(private readonly api: LocalApiClient) {}
  list(): Promise<ScoringSystem[]> { return this.api.get('/scoring-systems'); }
  getById(id: string): Promise<ScoringSystem | null> { return this.api.getNullable(`/scoring-systems/${id}`); }
  create(input: Omit<ScoringSystem, 'id' | 'isBuiltin'>): Promise<ScoringSystem> { return this.api.post('/scoring-systems', input); }
  update(id: string, input: Omit<ScoringSystem, 'id' | 'isBuiltin'>): Promise<ScoringSystem> { return this.api.put(`/scoring-systems/${id}`, input); }
  remove(id: string): Promise<void> { return this.api.delete(`/scoring-systems/${id}`); }
}
class LocalGarageUpgradesRepo implements GarageUpgradesRepository {
  constructor(private readonly api: LocalApiClient) {}
  list(): Promise<GarageUpgrade[]> { return this.api.get('/garage-upgrades'); }
  getById(id: string): Promise<GarageUpgrade | null> { return this.api.getNullable(`/garage-upgrades/${id}`); }
  create(input: Omit<GarageUpgrade, 'id'>): Promise<GarageUpgrade> { return this.api.post('/garage-upgrades', input); }
  update(id: string, input: Omit<GarageUpgrade, 'id'>): Promise<GarageUpgrade> { return this.api.put(`/garage-upgrades/${id}`, input); }
  remove(id: string): Promise<void> { return this.api.delete(`/garage-upgrades/${id}`); }
}
class LocalBadgesRepo implements BadgesRepository {
  constructor(private readonly api: LocalApiClient) {}
  listDefinitions(): Promise<BadgeDefinition[]> { return this.api.get('/badges/definitions'); }
  listAwards(filters: { driverId?: string; raceId?: string; associationId?: string } = {}): Promise<BadgeAward[]> {
    const params = new URLSearchParams(Object.entries(filters).filter((x): x is [string, string] => !!x[1]));
    return this.api.get(`/badges/awards?${params}`);
  }
}

class LocalChampionshipsRepo implements ChampionshipsRepository {
  constructor(private readonly api: LocalApiClient) {}

  list(): Promise<Championship[]> {
    return this.api.get<Championship[]>('/championships');
  }

  listActive(): Promise<Championship[]> {
    return this.api.get<Championship[]>('/championships/active');
  }

  getById(id: string): Promise<Championship | null> {
    return this.api.getNullable<Championship>(`/championships/${id}`);
  }

  createWithCalendar(
    input: CreateChampionshipRequest
  ): Promise<Championship> {
    return this.api.post<Championship>('/championships', input);
  }

  update(id: string, input: ChampionshipUpdateInput): Promise<Championship> {
    return this.api.put<Championship>(`/championships/${id}`, input);
  }

  remove(id: string): Promise<void> {
    return this.api.delete(`/championships/${id}`);
  }

  finalizeChampionship(id: string): Promise<Championship> {
    return this.api.post<Championship>(`/championships/${id}/finalize`);
  }

  listBySeries(seriesId: string): Promise<Championship[]> {
    return this.api.get<Championship[]>(`/championships/series/${seriesId}`);
  }

  listRaces(championshipId: string): Promise<Race[]> {
    return this.api.get<Race[]>(`/championships/${championshipId}/races`);
  }

  listPlannedRaces(championshipId: string): Promise<Race[]> {
    return this.api.get<Race[]>(
      `/championships/${championshipId}/races/planned`
    );
  }

  updatePlannedRaceTrack(
    raceId: string,
    trackId: string | null
  ): Promise<Race> {
    return this.api.patch<Race>(`/championships/races/${raceId}/track`, {
      trackId,
    });
  }

  addPlannedRounds(
    championshipId: string,
    rounds: PlannedRoundInput[]
  ): Promise<void> {
    return this.api.post<void>(`/championships/${championshipId}/rounds`, {
      rounds,
    });
  }

  getStandings(championshipId: string): Promise<StandingRow[]> {
    return this.api.get<StandingRow[]>(
      `/championships/${championshipId}/standings`
    );
  }

  getProgression(
    championshipId: string
  ): Promise<ChampionshipProgression> {
    return this.api.get<ChampionshipProgression>(
      `/championships/${championshipId}/progression`
    );
  }

  async listResultsByRaceIds(
    raceIds: string[]
  ): Promise<Map<string, RaceResult[]>> {
    const record = await this.api.post<Record<string, RaceResult[]>>(
      '/championships/results-by-race-ids',
      { raceIds }
    );
    return new Map(Object.entries(record ?? {}));
  }

  getOverallStandings(): Promise<StandingRow[]> {
    return this.api.get<StandingRow[]>('/championships/standings/overall');
  }

  getSeriesChampions(seriesId: string): Promise<SeriesChampionRow[]> {
    return this.api.get<SeriesChampionRow[]>(
      `/championships/series/${seriesId}/champions`
    );
  }

  getGlobalChampionsHall(): Promise<GlobalChampionRow[]> {
    return this.api.get<GlobalChampionRow[]>('/championships/hall');
  }

  getDriverTitles(driverId: string): Promise<TitleWin[]> {
    return this.api.get<TitleWin[]>(
      `/championships/titles/driver/${driverId}`
    );
  }

  getCarTitles(carId: string): Promise<TitleWin[]> {
    return this.api.get<TitleWin[]>(`/championships/titles/car/${carId}`);
  }

  getConstructorStandings(
    championshipId: string
  ): Promise<ConstructorStandingRow[]> {
    return this.api.get<ConstructorStandingRow[]>(
      `/championships/${championshipId}/constructor-standings`
    );
  }

  computeTitleFight(championshipId: string): Promise<StandingRow[]> {
    return this.api.get<StandingRow[]>(
      `/championships/${championshipId}/title-fight`
    );
  }

  async getPreviousSeriesChampionDriverId(
    seriesId: string,
    beforeEditionNumber: number
  ): Promise<string | null> {
    const res = await this.api.get<{ driverId: string | null }>(
      `/championships/series/${seriesId}/previous-champion?beforeEdition=${beforeEditionNumber}`
    );
    return res?.driverId ?? null;
  }

  listCars(championshipId: string): Promise<string[]> {
    return this.api.get<string[]>(`/championships/${championshipId}/cars`);
  }

  listEntries(championshipId: string): Promise<ChampionshipEntry[]> {
    return this.api.get<ChampionshipEntry[]>(
      `/championships/${championshipId}/entries`
    );
  }

  upsertEntry(
    championshipId: string,
    input: ChampionshipEntryInput
  ): Promise<ChampionshipEntry> {
    return this.api.put<ChampionshipEntry>(
      `/championships/${championshipId}/entries`,
      input
    );
  }

  removeEntry(championshipId: string, entryId: string): Promise<void> {
    return this.api.delete(
      `/championships/${championshipId}/entries/${entryId}`
    );
  }

  setEntryUpgrades(
    championshipId: string,
    entryId: string,
    garageUpgradeIds: string[]
  ): Promise<ChampionshipEntry> {
    return this.api.put<ChampionshipEntry>(
      `/championships/${championshipId}/entries/${entryId}/upgrades`,
      { garageUpgradeIds }
    );
  }
}

class LocalRacesRepo implements RacesRepository {
  constructor(private readonly api: LocalApiClient) {}

  listRecent(limit = 10): Promise<Race[]> {
    return this.api.get<Race[]>(`/races/recent?limit=${limit}`);
  }

  getRace(id: string): Promise<Race | null> {
    return this.api.getNullable<Race>(`/races/${id}`);
  }

  listResultsByRace(raceId: string): Promise<RaceResult[]> {
    return this.api.get<RaceResult[]>(`/races/${raceId}/results`);
  }

  completePlannedRace(
    request: CompletePlannedRaceRequest
  ): Promise<Race> {
    this.validateResults(request.results);
    return this.api.post<Race>('/races/complete-planned', request);
  }

  logStandaloneRace(request: LogStandaloneRaceRequest): Promise<Race> {
    this.validateResults(request.results);
    return this.api.post<Race>('/races/standalone', request);
  }

  cancelRace(raceId: string): Promise<Race> {
    return this.api.post<Race>(`/races/${raceId}/cancel`);
  }
  savePreRace(request: SavePreRaceRequest): Promise<Race> { return this.api.post('/races/pre-race', request); }
  startLive(raceId: string): Promise<Race> { return this.api.post(`/races/${raceId}/start-live`); }
  saveTelemetry(request: SaveTelemetryRequest): Promise<Race> { return this.api.put(`/races/${request.raceId}/telemetry`, request); }
  openPodium(raceId: string): Promise<Race> { return this.api.post(`/races/${raceId}/open-podium`); }
  completePostRace(request: CompletePostRaceRequest): Promise<Race> { return this.api.post('/races/post-race', request); }

  getDriverStats(): Promise<DriverStatRow[]> {
    return this.api.get<DriverStatRow[]>('/races/stats/drivers');
  }

  getCarStats(): Promise<CarStatRow[]> {
    return this.api.get<CarStatRow[]>('/races/stats/cars');
  }

  getDriverResultHistory(driverId: string): Promise<ResultHistoryRow[]> {
    return this.api.get<ResultHistoryRow[]>(
      `/races/history/driver/${driverId}`
    );
  }

  getCarResultHistory(carId: string): Promise<ResultHistoryRow[]> {
    return this.api.get<ResultHistoryRow[]>(`/races/history/car/${carId}`);
  }

  getDriverBreakdownByCar(driverId: string): Promise<BreakdownStatRow[]> {
    return this.api.get<BreakdownStatRow[]>(
      `/races/breakdown/driver/${driverId}/by-car`
    );
  }

  getDriverBreakdownByTrack(driverId: string): Promise<BreakdownStatRow[]> {
    return this.api.get<BreakdownStatRow[]>(
      `/races/breakdown/driver/${driverId}/by-track`
    );
  }

  getCarBreakdownByDriver(carId: string): Promise<BreakdownStatRow[]> {
    return this.api.get<BreakdownStatRow[]>(
      `/races/breakdown/car/${carId}/by-driver`
    );
  }

  getCarBreakdownByTrack(carId: string): Promise<BreakdownStatRow[]> {
    return this.api.get<BreakdownStatRow[]>(
      `/races/breakdown/car/${carId}/by-track`
    );
  }

  getTrackDriverHistory(trackId: string): Promise<TrackDriverHistoryRow[]> {
    return this.api.get<TrackDriverHistoryRow[]>(
      `/races/tracks/${trackId}/driver-history`
    );
  }

  getDriverHeadToHead(driverId: string): Promise<HeadToHeadRow[]> {
    return this.api.get<HeadToHeadRow[]>(
      `/races/head-to-head/${driverId}`
    );
  }

  getDriverBestFinish(
    driverId: string
  ): Promise<{ position: number; racedAt?: string; trackName?: string } | null> {
    return this.api.get(
      `/races/best-finish/${driverId}`
    );
  }

  pointsForPosition = sharedPoints;
  validateResults = sharedValidate;
}

export class LocalApiDataProvider implements DataProvider {
  readonly mode: StorageMode = 'local';
  readonly cars: CarsRepository;
  readonly drivers: DriversRepository;
  readonly tracks: TracksRepository;
  readonly associations: AssociationsRepository;
  readonly scoringSystems: ScoringSystemsRepository;
  readonly garageUpgrades: GarageUpgradesRepository;
  readonly badges: BadgesRepository;
  readonly championships: ChampionshipsRepository;
  readonly races: RacesRepository;

  constructor(http: HttpClient, session: SessionService) {
    const api = new LocalApiClient(http, session);
    this.cars = new LocalCarsRepo(api);
    this.drivers = new LocalDriversRepo(api);
    this.tracks = new LocalTracksRepo(api);
    this.associations = new LocalAssociationsRepo(api);
    this.scoringSystems = new LocalScoringSystemsRepo(api);
    this.garageUpgrades = new LocalGarageUpgradesRepo(api);
    this.badges = new LocalBadgesRepo(api);
    this.championships = new LocalChampionshipsRepo(api);
    this.races = new LocalRacesRepo(api);
  }
}
