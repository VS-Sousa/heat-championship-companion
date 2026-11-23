import {
  Championship,
  ChampionshipProgression,
  CreateChampionshipRequest,
  GlobalChampionRow,
  PlannedRoundInput,
  ProgressionDriverSeries,
  Race,
  RaceResult,
  SeriesChampionRow,
  StandingRow,
  TitleWin,
} from '../../../models/domain.models';
import { formatDriverName } from '../../../utils/driver-display';
import { CAR_COLORS } from '../../../utils/car-colors';
import {
  ChampionshipsRepository,
  ChampionshipUpdateInput,
  DataProvider,
} from '../../data-provider';
import { newId, PreviewStore } from './preview-store';

export class PreviewChampionshipsRepo implements ChampionshipsRepository {
  constructor(
    private readonly store: PreviewStore,
    private readonly provider: DataProvider
  ) {}

  async list(): Promise<Championship[]> {
    return [...this.store.snapshot().championships].sort((a, b) =>
      (b.finishedAt ?? '').localeCompare(a.finishedAt ?? '')
    );
  }

  async listActive(): Promise<Championship[]> {
    return (await this.list()).filter((championship) => championship.isActive);
  }

  async getById(id: string): Promise<Championship | null> {
    return (
      this.store.snapshot().championships.find((championship) => championship.id === id) ??
      null
    );
  }

  async createWithCalendar(
    input: CreateChampionshipRequest
  ): Promise<Championship> {
    if (!input.calendar.length) {
      throw new Error('Add at least one planned round.');
    }

    let seriesId = newId();
    let editionNumber = 1;
    if (input.successionOfId) {
      const previous = await this.getById(input.successionOfId);
      if (!previous) throw new Error('Previous championship not found.');
      seriesId = previous.seriesId;
      const siblings = await this.listBySeries(seriesId);
      editionNumber =
        Math.max(...siblings.map((sibling) => sibling.editionNumber), 0) + 1;
      if (previous.isActive) await this.finalizeChampionship(previous.id);
    }

    const championship: Championship = {
      id: newId(),
      name: input.name,
      season: input.season,
      seriesId,
      editionNumber,
      pointSystem: [...input.pointSystem],
      useGarage: input.useGarage,
      useEvents: input.useEvents,
      usePress: input.usePress,
      useSponsorship: input.useSponsorship,
      associationId: input.associationId,
      scoringSystemId: input.scoringSystemId,
      isActive: true,
    };
    this.store.update((draft) => {
      draft.championships.push(championship);
      draft.races.push(
        ...this.calendarRaces(championship.id, input.calendar)
      );
    });
    return championship;
  }

  async update(
    id: string,
    input: ChampionshipUpdateInput
  ): Promise<Championship> {
    let updated: Championship | undefined;
    this.store.update((draft) => {
      const index = draft.championships.findIndex((item) => item.id === id);
      if (index < 0) throw new Error('Championship not found.');
      const existing = draft.championships[index];
      updated = {
        ...existing,
        name: input.name,
        season: input.season,
        seriesId: input.seriesId ?? existing.seriesId,
        editionNumber: input.editionNumber ?? existing.editionNumber,
        pointSystem: [...input.pointSystem],
        useGarage: input.useGarage,
        useEvents: input.useEvents,
        usePress: input.usePress,
        useSponsorship: input.useSponsorship,
        associationId: input.associationId,
        scoringSystemId: input.scoringSystemId,
        isActive: input.isActive,
      };
      draft.championships[index] = updated;
    });
    return updated!;
  }

  async remove(id: string): Promise<void> {
    this.store.update((draft) => {
      const raceIds = new Set(
        draft.races
          .filter((race) => race.championshipId === id)
          .map((race) => race.id)
      );
      draft.results = draft.results.filter(
        (result) => !raceIds.has(result.raceId)
      );
      draft.races = draft.races.filter((race) => race.championshipId !== id);
      draft.championships = draft.championships.filter(
        (championship) => championship.id !== id
      );
    });
  }

  async finalizeChampionship(id: string): Promise<Championship> {
    let updated: Championship | undefined;
    this.store.update((draft) => {
      const index = draft.championships.findIndex((item) => item.id === id);
      if (index < 0) throw new Error('Championship not found.');
      updated = {
        ...draft.championships[index],
        isActive: false,
        finishedAt: new Date().toISOString(),
      };
      draft.championships[index] = updated;
    });
    return updated!;
  }

  async listBySeries(seriesId: string): Promise<Championship[]> {
    return this.store
      .snapshot()
      .championships.filter((championship) => championship.seriesId === seriesId)
      .sort((a, b) => b.editionNumber - a.editionNumber);
  }

  async listRaces(championshipId: string): Promise<Race[]> {
    return this.store
      .snapshot()
      .races.filter((race) => race.championshipId === championshipId)
      .sort((a, b) => (a.roundNumber ?? 0) - (b.roundNumber ?? 0));
  }

  async listPlannedRaces(championshipId: string): Promise<Race[]> {
    return (await this.listRaces(championshipId)).filter(
      (race) => race.status === 'planned'
    );
  }

  async updatePlannedRaceTrack(
    raceId: string,
    trackId: string | null
  ): Promise<Race> {
    let updated: Race | undefined;
    this.store.update((draft) => {
      const index = draft.races.findIndex(
        (race) => race.id === raceId && race.status === 'planned'
      );
      if (index < 0) throw new Error('Planned race not found.');
      updated = {
        ...draft.races[index],
        trackId: trackId ?? undefined,
      };
      draft.races[index] = updated;
    });
    return updated!;
  }

  async addPlannedRounds(
    championshipId: string,
    rounds: PlannedRoundInput[]
  ): Promise<void> {
    if (!(await this.getById(championshipId))) {
      throw new Error('Championship not found.');
    }
    this.store.update((draft) => {
      draft.races.push(...this.calendarRaces(championshipId, rounds));
    });
  }

  async getStandings(championshipId: string): Promise<StandingRow[]> {
    const championship = await this.getById(championshipId);
    if (!championship) return [];
    const races = await this.listRaces(championshipId);
    const standings = await this.aggregateStandings(
      races.filter((race) => race.status === 'completed').map((race) => race.id)
    );
    return this.applyTitleFight(
      standings,
      championship.pointSystem,
      races.filter((race) => race.status === 'planned').length
    );
  }

  async getProgression(
    championshipId: string
  ): Promise<ChampionshipProgression> {
    const completed = (await this.listRaces(championshipId))
      .filter((race) => race.status === 'completed')
      .sort((a, b) => (a.roundNumber ?? 0) - (b.roundNumber ?? 0));
    if (!completed.length) return { rounds: [], series: [] };

    const resultsByRace = await this.listResultsByRaceIds(
      completed.map((race) => race.id)
    );
    const [drivers, cars] = await Promise.all([
      this.provider.drivers.list(),
      this.provider.cars.list(),
    ]);
    const totals = new Map<
      string,
      {
        points: number;
        name: string;
        nickname?: string;
        abbreviation: string;
        number: number;
      }
    >();
    const carUsage = new Map<string, Map<string, number>>();
    const pointsAfter = new Map<string, number[]>();
    const finishesAfter = new Map<string, Array<number | null>>();
    const dnfsAfter = new Map<string, boolean[]>();

    for (let roundIndex = 0; roundIndex < completed.length; roundIndex++) {
      const results = resultsByRace.get(completed[roundIndex].id) ?? [];
      const roundFinishes = new Map<
        string,
        { position: number; dnf: boolean }
      >();
      for (const result of results) {
        const driver = drivers.find((item) => item.id === result.driverId);
        if (!driver) continue;
        const current = totals.get(result.driverId) ?? {
          points: 0,
          name: driver.name,
          nickname: driver.nickname,
          abbreviation: driver.abbreviation,
          number: driver.number,
        };
        current.points += result.pointsAwarded;
        totals.set(result.driverId, current);
        roundFinishes.set(result.driverId, {
          position: result.position,
          dnf: result.dnf,
        });
        const usage = carUsage.get(result.driverId) ?? new Map<string, number>();
        usage.set(result.carId, (usage.get(result.carId) ?? 0) + 1);
        carUsage.set(result.driverId, usage);
        if (!pointsAfter.has(result.driverId)) {
          pointsAfter.set(result.driverId, Array(roundIndex).fill(0));
          finishesAfter.set(result.driverId, Array(roundIndex).fill(null));
          dnfsAfter.set(result.driverId, Array(roundIndex).fill(false));
        }
      }
      for (const [driverId, total] of totals) {
        const points = pointsAfter.get(driverId) ?? Array(roundIndex).fill(0);
        const finishes =
          finishesAfter.get(driverId) ?? Array(roundIndex).fill(null);
        const dnfs = dnfsAfter.get(driverId) ?? Array(roundIndex).fill(false);
        while (points.length < roundIndex)
          points.push(points[points.length - 1] ?? 0);
        while (finishes.length < roundIndex) finishes.push(null);
        while (dnfs.length < roundIndex) dnfs.push(false);
        const finish = roundFinishes.get(driverId);
        points.push(total.points);
        finishes.push(finish?.position ?? null);
        dnfs.push(finish?.dnf ?? false);
        pointsAfter.set(driverId, points);
        finishesAfter.set(driverId, finishes);
        dnfsAfter.set(driverId, dnfs);
      }
    }

    const series: ProgressionDriverSeries[] = [...totals.entries()].map(
      ([driverId, info], index) => ({
        driverId,
        driverName: info.name,
        nickname: info.nickname,
        abbreviation: info.abbreviation,
        number: info.number,
        color: this.resolveMostUsedCarColor(
          carUsage.get(driverId),
          cars,
          index
        ),
        pointsAfterRound: this.padNumberSeries(
          pointsAfter.get(driverId) ?? [],
          completed.length
        ),
        finishPositionByRound: this.padNullableSeries(
          finishesAfter.get(driverId) ?? [],
          completed.length
        ),
        dnfByRound: this.padBooleanSeries(
          dnfsAfter.get(driverId) ?? [],
          completed.length
        ),
      })
    );
    series.sort(
      (a, b) =>
        (b.pointsAfterRound.at(-1) ?? 0) - (a.pointsAfterRound.at(-1) ?? 0)
    );
    return {
      rounds: completed.map((race) => ({
        raceId: race.id,
        roundNumber: race.roundNumber ?? 0,
        trackId: race.trackId,
      })),
      series,
    };
  }

  async listResultsByRaceIds(
    raceIds: string[]
  ): Promise<Map<string, RaceResult[]>> {
    const wanted = new Set(raceIds);
    const grouped = new Map<string, RaceResult[]>();
    for (const result of this.store.snapshot().results) {
      if (!wanted.has(result.raceId)) continue;
      const list = grouped.get(result.raceId) ?? [];
      list.push(result);
      grouped.set(result.raceId, list);
    }
    for (const [raceId, results] of grouped) {
      grouped.set(
        raceId,
        results.sort((a, b) => a.position - b.position)
      );
    }
    return grouped;
  }

  async getOverallStandings(): Promise<StandingRow[]> {
    return this.aggregateStandings(
      this.store
        .snapshot()
        .races.filter((race) => race.status === 'completed')
        .map((race) => race.id)
    );
  }

  async getSeriesChampions(seriesId: string): Promise<SeriesChampionRow[]> {
    const editions = await this.listBySeries(seriesId);
    const cars = await this.provider.cars.list();
    const rows: SeriesChampionRow[] = [];
    for (const edition of editions) {
      const base: SeriesChampionRow = {
        championshipId: edition.id,
        championshipName: edition.name,
        season: edition.season,
        editionNumber: edition.editionNumber,
        finishedAt: edition.finishedAt,
      };
      if (!edition.isActive || edition.finishedAt) {
        const champion = (await this.getStandings(edition.id))[0];
        if (champion) {
          const bestCar = await this.bestCarForDriverInChampionship(
            edition.id,
            champion.driverId
          );
          const car = cars.find((item) => item.id === bestCar?.carId);
          rows.push({
            ...base,
            driverId: champion.driverId,
            driverName: formatDriverName({
              name: champion.driverName,
              nickname: champion.nickname,
            }),
            nickname: champion.nickname,
            carId: bestCar?.carId,
            carName: car?.name ?? bestCar?.carName,
            carColorHex: car?.colorHex,
            points: champion.points,
          });
          continue;
        }
      }
      rows.push(base);
    }
    return rows;
  }

  async getGlobalChampionsHall(): Promise<GlobalChampionRow[]> {
    const championships = (await this.list()).filter(
      (championship) => !championship.isActive || !!championship.finishedAt
    );
    const drivers = await this.provider.drivers.list();
    const tally = new Map<
      string,
      { titles: number; lastSeason?: string; lastEdition: number; lastCar?: string }
    >();
    for (const championship of championships) {
      const champion = (await this.getStandings(championship.id))[0];
      if (!champion) continue;
      const car = await this.bestCarForDriverInChampionship(
        championship.id,
        champion.driverId
      );
      const current = tally.get(champion.driverId) ?? {
        titles: 0,
        lastEdition: -1,
      };
      current.titles += 1;
      if (championship.editionNumber >= current.lastEdition) {
        current.lastEdition = championship.editionNumber;
        current.lastSeason = championship.season;
        current.lastCar = car?.carName;
      }
      tally.set(champion.driverId, current);
    }
    return drivers
      .filter((driver) => tally.has(driver.id))
      .map((driver) => {
        const stats = tally.get(driver.id)!;
        return {
          driverId: driver.id,
          driverName: formatDriverName(driver),
          nickname: driver.nickname,
          abbreviation: driver.abbreviation,
          number: driver.number,
          isLegend: driver.isLegend,
          titles: stats.titles,
          lastTitleSeason: stats.lastSeason,
          lastTitleCarName: stats.lastCar,
        };
      })
      .sort(
        (a, b) =>
          b.titles - a.titles ||
          (b.lastTitleSeason ?? '').localeCompare(a.lastTitleSeason ?? '')
      );
  }

  async getDriverTitles(driverId: string): Promise<TitleWin[]> {
    const championships = (await this.list()).filter(
      (championship) => !championship.isActive || !!championship.finishedAt
    );
    const wins: TitleWin[] = [];
    for (const championship of championships) {
      if ((await this.getStandings(championship.id))[0]?.driverId !== driverId)
        continue;
      const car = await this.bestCarForDriverInChampionship(
        championship.id,
        driverId
      );
      wins.push({
        championshipId: championship.id,
        championshipName: championship.name,
        season: championship.season,
        editionNumber: championship.editionNumber,
        carId: car?.carId,
        carName: car?.carName,
        driverId,
      });
    }
    return wins.sort((a, b) => b.editionNumber - a.editionNumber);
  }

  async getCarTitles(carId: string): Promise<TitleWin[]> {
    const championships = (await this.list()).filter(
      (championship) => !championship.isActive || !!championship.finishedAt
    );
    const drivers = await this.provider.drivers.list();
    const wins: TitleWin[] = [];
    for (const championship of championships) {
      const champion = (await this.getStandings(championship.id))[0];
      if (!champion) continue;
      const car = await this.bestCarForDriverInChampionship(
        championship.id,
        champion.driverId
      );
      if (car?.carId !== carId) continue;
      const driver = drivers.find((item) => item.id === champion.driverId);
      wins.push({
        championshipId: championship.id,
        championshipName: championship.name,
        season: championship.season,
        editionNumber: championship.editionNumber,
        carId,
        carName: car.carName,
        driverId: champion.driverId,
        driverName: driver ? formatDriverName(driver) : champion.driverName,
      });
    }
    return wins.sort((a, b) => b.editionNumber - a.editionNumber);
  }

  applyTitleFight(
    standings: StandingRow[],
    pointSystem: number[],
    remainingPlanned: number
  ): StandingRow[] {
    if (!standings.length) return standings;
    const maximum = Math.max(...pointSystem, 0);
    const leaderPoints = standings[0].points;
    return standings.map((standing) => ({
      ...standing,
      inTitleFight:
        remainingPlanned === 0
          ? standing.points === leaderPoints
          : standing.points + remainingPlanned * maximum >= leaderPoints,
    }));
  }

  private calendarRaces(
    championshipId: string,
    rounds: PlannedRoundInput[]
  ): Race[] {
    const createdAt = new Date().toISOString();
    return rounds.map((round) => ({
      id: newId(),
      championshipId,
      trackId: round.trackId || undefined,
      roundNumber: round.roundNumber,
      raceType: 'championship',
      status: 'planned',
      createdAt,
    }));
  }

  private async aggregateStandings(raceIds: string[]): Promise<StandingRow[]> {
    if (!raceIds.length) return [];
    const raceIdSet = new Set(raceIds);
    const drivers = await this.provider.drivers.list();
    const byDriver = new Map<string, StandingRow>();
    for (const result of this.store.snapshot().results) {
      if (!raceIdSet.has(result.raceId)) continue;
      const driver = drivers.find((item) => item.id === result.driverId);
      if (!driver) continue;
      const current = byDriver.get(driver.id) ?? {
        driverId: driver.id,
        driverName: driver.name,
        nickname: driver.nickname,
        abbreviation: driver.abbreviation,
        number: driver.number,
        points: 0,
        wins: 0,
        podiums: 0,
        races: 0,
      };
      current.points += result.pointsAwarded;
      current.races += 1;
      if (!result.dnf && result.position === 1) current.wins += 1;
      if (!result.dnf && result.position <= 3) current.podiums += 1;
      byDriver.set(driver.id, current);
    }
    return [...byDriver.values()].sort(
      (a, b) =>
        b.points - a.points ||
        b.wins - a.wins ||
        a.driverName.localeCompare(b.driverName)
    );
  }

  private async bestCarForDriverInChampionship(
    championshipId: string,
    driverId: string
  ): Promise<{ carId: string; carName: string } | null> {
    const raceIds = new Set(
      (await this.listRaces(championshipId))
        .filter((race) => race.status === 'completed')
        .map((race) => race.id)
    );
    const pointsByCar = new Map<string, number>();
    for (const result of this.store.snapshot().results) {
      if (result.driverId !== driverId || !raceIds.has(result.raceId)) continue;
      pointsByCar.set(
        result.carId,
        (pointsByCar.get(result.carId) ?? 0) + result.pointsAwarded
      );
    }
    const bestCarId = [...pointsByCar].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!bestCarId) return null;
    const car = (await this.provider.cars.list()).find(
      (item) => item.id === bestCarId
    );
    return car ? { carId: car.id, carName: car.name } : null;
  }

  private resolveMostUsedCarColor(
    usage: Map<string, number> | undefined,
    cars: { id: string; colorHex: string }[],
    fallbackIndex: number
  ): string {
    const bestCarId = usage
      ? [...usage].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0]
      : undefined;
    return (
      cars.find((car) => car.id === bestCarId)?.colorHex ??
      CAR_COLORS[fallbackIndex % CAR_COLORS.length].hex
    );
  }

  private padNumberSeries(values: number[], length: number): number[] {
    return values.length >= length
      ? values.slice(0, length)
      : [
          ...values,
          ...Array(length - values.length).fill(values.at(-1) ?? 0),
        ];
  }

  private padNullableSeries(
    values: Array<number | null>,
    length: number
  ): Array<number | null> {
    return values.length >= length
      ? values.slice(0, length)
      : [...values, ...Array(length - values.length).fill(null)];
  }

  private padBooleanSeries(values: boolean[], length: number): boolean[] {
    return values.length >= length
      ? values.slice(0, length)
      : [...values, ...Array(length - values.length).fill(false)];
  }
}
