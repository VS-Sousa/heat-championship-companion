import { HttpClient } from '@angular/common/http';
import {
  BreakdownStatRow,
  Car,
  CarStatRow,
  Championship,
  ChampionshipProgression,
  CompletePlannedRaceRequest,
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
} from '../../../models/domain.models';
import {
  CarsRepository,
  ChampionshipUpdateInput,
  ChampionshipsRepository,
  DataProvider,
  DriversRepository,
  RacesRepository,
  TracksRepository,
} from '../../data-provider';
import {
  pointsForPosition as sharedPoints,
  validateResults as sharedValidate,
} from '../../shared/race-rules';
import { StorageMode } from '../../storage-mode';

const NOT_READY =
  'Local API is not implemented yet. See server/README.md or switch storage mode.';

function reject<T>(): Promise<T> {
  return Promise.reject(new Error(NOT_READY));
}

class LocalCarsRepo implements CarsRepository {
  list = () => reject<Car[]>();
  getById = () => reject<Car | null>();
  create = () => reject<Car>();
  update = () => reject<Car>();
  remove = () => reject<void>();
}

class LocalDriversRepo implements DriversRepository {
  list = () => reject<Driver[]>();
  getById = () => reject<Driver | null>();
  create = () => reject<Driver>();
  update = () => reject<Driver>();
  remove = () => reject<void>();
}

class LocalTracksRepo implements TracksRepository {
  list = () => reject<Track[]>();
  getById = () => reject<Track | null>();
  create = () => reject<Track>();
  update = () => reject<Track>();
  remove = () => reject<void>();
}

class LocalChampionshipsRepo implements ChampionshipsRepository {
  list = () => reject<Championship[]>();
  listActive = () => reject<Championship[]>();
  getById = () => reject<Championship | null>();
  createWithCalendar = () => reject<Championship>();
  update = (_id: string, _input: ChampionshipUpdateInput) =>
    reject<Championship>();
  remove = () => reject<void>();
  finalizeChampionship = () => reject<Championship>();
  listBySeries = () => reject<Championship[]>();
  listRaces = () => reject<Race[]>();
  listPlannedRaces = () => reject<Race[]>();
  updatePlannedRaceTrack = () => reject<Race>();
  addPlannedRounds = (
    _championshipId: string,
    _rounds: PlannedRoundInput[]
  ) => reject<void>();
  getStandings = () => reject<StandingRow[]>();
  getProgression = () => reject<ChampionshipProgression>();
  listResultsByRaceIds = () => reject<Map<string, RaceResult[]>>();
  getOverallStandings = () => reject<StandingRow[]>();
  getSeriesChampions = () => reject<SeriesChampionRow[]>();
  getGlobalChampionsHall = () => reject<GlobalChampionRow[]>();
  getDriverTitles = () => reject<TitleWin[]>();
  getCarTitles = () => reject<TitleWin[]>();
  applyTitleFight(
    standings: StandingRow[],
    pointSystem: number[],
    remainingPlanned: number
  ): StandingRow[] {
    if (!standings.length) return standings;
    const maxPts = Math.max(...pointSystem, 0);
    const leaderPoints = standings[0].points;
    return standings.map((row) => ({
      ...row,
      inTitleFight:
        remainingPlanned === 0
          ? row.points === leaderPoints
          : row.points + remainingPlanned * maxPts >= leaderPoints,
    }));
  }
}

class LocalRacesRepo implements RacesRepository {
  listRecent = () => reject<Race[]>();
  getRace = () => reject<Race | null>();
  listResultsByRace = () => reject<RaceResult[]>();
  completePlannedRace = (_request: CompletePlannedRaceRequest) =>
    reject<Race>();
  logStandaloneRace = (_request: LogStandaloneRaceRequest) => reject<Race>();
  cancelRace = () => reject<Race>();
  getDriverStats = () => reject<DriverStatRow[]>();
  getCarStats = () => reject<CarStatRow[]>();
  getDriverResultHistory = () => reject<ResultHistoryRow[]>();
  getCarResultHistory = () => reject<ResultHistoryRow[]>();
  getDriverBreakdownByCar = () => reject<BreakdownStatRow[]>();
  getDriverBreakdownByTrack = () => reject<BreakdownStatRow[]>();
  getCarBreakdownByDriver = () => reject<BreakdownStatRow[]>();
  getCarBreakdownByTrack = () => reject<BreakdownStatRow[]>();
  getTrackDriverHistory = () => reject<TrackDriverHistoryRow[]>();
  getDriverHeadToHead = () => reject<HeadToHeadRow[]>();
  getDriverBestFinish = () =>
    reject<{ position: number; racedAt?: string; trackName?: string } | null>();
  pointsForPosition = sharedPoints;
  validateResults = sharedValidate;
}

/**
 * Stub for future HTTP backend. Keeps HttpClient + baseUrl ready;
 * all data methods reject until server/ is implemented.
 */
export class LocalApiDataProvider implements DataProvider {
  readonly mode: StorageMode = 'local';
  readonly cars = new LocalCarsRepo();
  readonly drivers = new LocalDriversRepo();
  readonly tracks = new LocalTracksRepo();
  readonly championships = new LocalChampionshipsRepo();
  readonly races = new LocalRacesRepo();

  constructor(
    _http: HttpClient,
    readonly baseUrl: string
  ) {}
}
