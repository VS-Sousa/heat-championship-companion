import {
  Championship,
  ChampionshipEntry,
  ChampionshipProgression,
  ConstructorStandingRow,
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
  ChampionshipEntryInput,
  ChampionshipsRepository,
  ChampionshipUpdateInput,
  DataProvider,
} from '../../data-provider';
import {
  applyResultToStanding,
  emptyStandingAccum,
  sortStandingRows,
} from '../../shared/standings-sort';
import { computeTitleContention } from '../../shared/title-fight';
import { resolveDriverLabel } from './preview-driver-label';
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
    if (!input.scoringSystemId) {
      throw new Error('Select a scoring system.');
    }
    const carIds = [...new Set(input.carIds)];
    if (!carIds.length) {
      throw new Error('Select at least one car for the championship.');
    }
    const knownCars = new Set(this.store.snapshot().cars.map((car) => car.id));
    if (carIds.some((carId) => !knownCars.has(carId))) {
      throw new Error('Car not found.');
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
      scoringSystemId: input.scoringSystemId,
      isActive: true,
    };
    this.store.update((draft) => {
      draft.championships.push(championship);
      draft.championshipCars[championship.id] = carIds;
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
      delete draft.championshipCars[id];
      draft.championshipEntries = draft.championshipEntries.filter(
        (entry) => entry.championshipId !== id
      );
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
    return this.aggregateStandings(
      races.filter((race) => race.status === 'completed').map((race) => race.id),
      championshipId
    );
  }

  async getConstructorStandings(
    championshipId: string
  ): Promise<ConstructorStandingRow[]> {
    const championship = await this.getById(championshipId);
    if (!championship) return [];
    const db = this.store.snapshot();
    const completed = new Set(
      (await this.listRaces(championshipId))
        .filter((race) => race.status === 'completed')
        .map((race) => race.id)
    );
    const cars = await this.provider.cars.list();
    const byCar = new Map<string, ConstructorStandingRow>();
    const rowFor = (carId: string): ConstructorStandingRow | null => {
      const existing = byCar.get(carId);
      if (existing) return existing;
      const car = cars.find((item) => item.id === carId);
      if (!car) return null;
      const row: ConstructorStandingRow = {
        carId,
        carName: car.name,
        colorHex: car.colorHex,
        points: 0,
        wins: 0,
        podiums: 0,
        races: 0,
      };
      byCar.set(carId, row);
      return row;
    };
    for (const carId of db.championshipCars[championshipId] ?? []) rowFor(carId);
    for (const result of db.results) {
      if (!completed.has(result.raceId)) continue;
      const row = rowFor(result.carId);
      if (!row) continue;
      row.points += result.pointsAwarded;
      row.races += 1;
      if (result.position === 1) row.wins += 1;
      if (result.position <= 3) row.podiums += 1;
    }
    return [...byCar.values()].sort(
      (a, b) =>
        b.points - a.points ||
        b.wins - a.wins ||
        b.podiums - a.podiums ||
        a.carName.localeCompare(b.carName)
    );
  }

  async computeTitleFight(championshipId: string): Promise<StandingRow[]> {
    const championship = await this.getById(championshipId);
    if (!championship) return [];
    const races = await this.listRaces(championshipId);
    const standings = await this.getStandings(championshipId);
    const entries = await this.listEntries(championshipId);
    const drivers = await this.provider.drivers.list();

    // Entered drivers with no results yet still compete for the title.
    const field = [...standings];
    for (const entry of entries) {
      if (field.some((row) => row.driverId === entry.driverId)) continue;
      const driver = drivers.find((item) => item.id === entry.driverId);
      if (!driver) continue;
      field.push({
        ...emptyStandingAccum({
          driverId: driver.id,
          driverName: driver.name,
          nickname: driver.nickname,
          abbreviation: entry.abbreviation,
          number: entry.number,
        }),
      });
    }
    return computeTitleContention({
      standings: sortStandingRows(field),
      remainingPlanned: races.filter((race) => race.status === 'planned')
        .length,
      gridSize: Math.max(entries.length, field.length),
      pointSystem: championship.pointSystem,
    });
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
    const entries = this.store.snapshot().championshipEntries;
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

    for (let roundIndex = 0; roundIndex < completed.length; roundIndex++) {
      const results = resultsByRace.get(completed[roundIndex].id) ?? [];
      const roundFinishes = new Map<string, { position: number }>();
      for (const result of results) {
        const driver = drivers.find((item) => item.id === result.driverId);
        if (!driver) continue;
        const label = resolveDriverLabel(driver, entries, championshipId);
        const current = totals.get(result.driverId) ?? {
          points: 0,
          name: driver.name,
          nickname: driver.nickname,
          abbreviation: label.abbreviation,
          number: label.number,
        };
        current.points += result.pointsAwarded;
        totals.set(result.driverId, current);
        roundFinishes.set(result.driverId, {
          position: result.position,
        });
        const usage = carUsage.get(result.driverId) ?? new Map<string, number>();
        usage.set(result.carId, (usage.get(result.carId) ?? 0) + 1);
        carUsage.set(result.driverId, usage);
        if (!pointsAfter.has(result.driverId)) {
          pointsAfter.set(result.driverId, Array(roundIndex).fill(0));
          finishesAfter.set(result.driverId, Array(roundIndex).fill(null));
        }
      }
      for (const [driverId, total] of totals) {
        const points = pointsAfter.get(driverId) ?? Array(roundIndex).fill(0);
        const finishes =
          finishesAfter.get(driverId) ?? Array(roundIndex).fill(null);
        while (points.length < roundIndex)
          points.push(points[points.length - 1] ?? 0);
        while (finishes.length < roundIndex) finishes.push(null);
        const finish = roundFinishes.get(driverId);
        points.push(total.points);
        finishes.push(finish?.position ?? null);
        pointsAfter.set(driverId, points);
        finishesAfter.set(driverId, finishes);
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
          ...resolveDriverLabel(driver, this.store.snapshot().championshipEntries),
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

  async getPreviousSeriesChampionDriverId(
    seriesId: string,
    beforeEditionNumber: number
  ): Promise<string | null> {
    const previous = (await this.listBySeries(seriesId)).find(
      (edition) => edition.editionNumber < beforeEditionNumber
    );
    if (!previous || (previous.isActive && !previous.finishedAt)) return null;
    return (await this.getStandings(previous.id))[0]?.driverId ?? null;
  }

  async listCars(championshipId: string): Promise<string[]> {
    return [...(this.store.snapshot().championshipCars[championshipId] ?? [])];
  }

  async listEntries(championshipId: string): Promise<ChampionshipEntry[]> {
    return this.store
      .snapshot()
      .championshipEntries.filter((entry) => entry.championshipId === championshipId)
      .map((entry) => ({
        ...entry,
        garageUpgradeIds: [...(entry.garageUpgradeIds ?? [])],
      }))
      .sort((a, b) => a.number - b.number);
  }

  async upsertEntry(
    championshipId: string,
    input: ChampionshipEntryInput
  ): Promise<ChampionshipEntry> {
    const championship = await this.requireOpenChampionship(championshipId);
    const db = this.store.snapshot();
    const driver = db.drivers.find((item) => item.id === input.driverId);
    if (!driver) throw new Error('Driver not found.');

    const allowedCars = db.championshipCars[championshipId] ?? [];
    if (!allowedCars.includes(input.carId)) {
      throw new Error('Car is not part of this championship.');
    }

    const number = Number(input.number);
    if (!Number.isInteger(number) || number < 1) {
      throw new Error('Car number must be a positive whole number.');
    }
    const abbreviation = (input.abbreviation ?? '').trim().toUpperCase();
    if (!abbreviation) throw new Error('Abbreviation is required.');

    const others = db.championshipEntries.filter(
      (entry) =>
        entry.championshipId === championshipId &&
        entry.driverId !== input.driverId
    );
    if (others.some((entry) => entry.carId === input.carId)) {
      throw new Error('Car is already assigned to another driver.');
    }
    if (others.some((entry) => entry.number === number)) {
      throw new Error('Number is already taken in this championship.');
    }
    if (others.some((entry) => entry.abbreviation.toUpperCase() === abbreviation)) {
      throw new Error('Abbreviation is already taken in this championship.');
    }
    if (number === 1 && !driver.isLegend) {
      const previousChampion = await this.getPreviousSeriesChampionDriverId(
        championship.seriesId,
        championship.editionNumber
      );
      if (previousChampion !== driver.id) {
        throw new Error(
          'Number 1 is reserved for legends or the previous series champion.'
        );
      }
    }

    const existing = db.championshipEntries.find(
      (entry) =>
        entry.championshipId === championshipId &&
        entry.driverId === input.driverId
    );
    const garageUpgradeIds =
      input.garageUpgradeIds !== undefined
        ? this.validateUpgrades(championship, driver.isLegend, input.garageUpgradeIds)
        : this.validateUpgrades(
            championship,
            driver.isLegend,
            existing?.garageUpgradeIds ?? [],
            true
          );

    const entry: ChampionshipEntry = {
      id: existing?.id ?? newId(),
      championshipId,
      driverId: input.driverId,
      carId: input.carId,
      number,
      abbreviation,
      garageUpgradeIds,
    };
    this.store.update((draft) => {
      const index = draft.championshipEntries.findIndex(
        (item) => item.id === entry.id
      );
      if (index >= 0) draft.championshipEntries[index] = entry;
      else draft.championshipEntries.push(entry);
    });
    return { ...entry, garageUpgradeIds: [...garageUpgradeIds] };
  }

  async removeEntry(championshipId: string, entryId: string): Promise<void> {
    await this.requireOpenChampionship(championshipId);
    const exists = this.store
      .snapshot()
      .championshipEntries.some(
        (entry) => entry.id === entryId && entry.championshipId === championshipId
      );
    if (!exists) throw new Error('Entry not found.');
    this.store.update((draft) => {
      draft.championshipEntries = draft.championshipEntries.filter(
        (entry) => entry.id !== entryId
      );
    });
  }

  async setEntryUpgrades(
    championshipId: string,
    entryId: string,
    garageUpgradeIds: string[]
  ): Promise<ChampionshipEntry> {
    const championship = await this.requireOpenChampionship(championshipId);
    const db = this.store.snapshot();
    const existing = db.championshipEntries.find(
      (entry) => entry.id === entryId && entry.championshipId === championshipId
    );
    if (!existing) throw new Error('Entry not found.');
    const driver = db.drivers.find((item) => item.id === existing.driverId);
    if (!driver) throw new Error('Driver not found.');
    const ids = this.validateUpgrades(championship, driver.isLegend, garageUpgradeIds);
    const updated: ChampionshipEntry = { ...existing, garageUpgradeIds: ids };
    this.store.update((draft) => {
      const index = draft.championshipEntries.findIndex(
        (entry) => entry.id === entryId
      );
      draft.championshipEntries[index] = updated;
    });
    return { ...updated, garageUpgradeIds: [...ids] };
  }

  private async requireOpenChampionship(id: string): Promise<Championship> {
    const championship = await this.getById(id);
    if (!championship) throw new Error('Championship not found.');
    if (!championship.isActive || championship.finishedAt) {
      throw new Error('Championship is finalized.');
    }
    return championship;
  }

  /**
   * Upgrades are only for human drivers in garage-enabled championships.
   * When `lenient` (re-saving existing data), invalid combinations are cleared
   * instead of rejected.
   */
  private validateUpgrades(
    championship: Championship,
    isLegend: boolean,
    ids: string[],
    lenient = false
  ): string[] {
    const unique = [...new Set(ids)];
    if (!unique.length) return [];
    if (isLegend || !championship.useGarage) {
      if (lenient) return [];
      throw new Error(
        'Garage upgrades are only available to human drivers in garage championships.'
      );
    }
    const known = new Set(
      this.store.snapshot().garageUpgrades.map((upgrade) => upgrade.id)
    );
    if (unique.some((id) => !known.has(id))) {
      throw new Error('Garage upgrade not found.');
    }
    return unique;
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

  private async aggregateStandings(
    raceIds: string[],
    championshipId?: string
  ): Promise<StandingRow[]> {
    if (!raceIds.length) return [];
    const raceIdSet = new Set(raceIds);
    const db = this.store.snapshot();
    const roundByRace = new Map(
      db.races.map((race) => [race.id, race.roundNumber])
    );
    const drivers = await this.provider.drivers.list();
    const byDriver = new Map<string, StandingRow>();
    for (const result of db.results) {
      if (!raceIdSet.has(result.raceId)) continue;
      const driver = drivers.find((item) => item.id === result.driverId);
      if (!driver) continue;
      const current =
        byDriver.get(driver.id) ??
        emptyStandingAccum({
          driverId: driver.id,
          driverName: driver.name,
          nickname: driver.nickname,
          ...resolveDriverLabel(driver, db.championshipEntries, championshipId),
        });
      applyResultToStanding(
        current,
        result,
        championshipId ? roundByRace.get(result.raceId) : undefined
      );
      byDriver.set(driver.id, current);
    }
    return sortStandingRows([...byDriver.values()]);
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
}
