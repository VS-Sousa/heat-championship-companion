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
import {
  mapChampionship,
  mapChampionshipEntry,
  mapRace,
  mapRaceResult,
} from '../../../services/mappers';
import { SupabaseService } from '../../../services/supabase.service';
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
  StandingAccum,
} from '../../shared/standings-sort';
import { computeTitleContention } from '../../shared/title-fight';
import {
  DriverIdentity,
  fallbackDriverIdentity,
  loadLatestDriverIdentities,
} from './supabase-driver-identity';

/** Races that still count towards the remaining calendar (not finished, not cancelled). */
const OPEN_RACE_STATUSES = new Set([
  'planned',
  'pre_race',
  'in_race',
  'post_race',
]);

export class SupabaseChampionshipsRepo implements ChampionshipsRepository {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly provider: DataProvider
  ) {}

  async list(): Promise<Championship[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('championships')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) =>
      mapChampionship(row as Record<string, unknown>)
    );
  }

  async listActive(): Promise<Championship[]> {
    const all = await this.list();
    return all.filter((c) => c.isActive);
  }

  async getById(id: string): Promise<Championship | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('championships')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapChampionship(data as Record<string, unknown>) : null;
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
    const carIds = [...new Set(input.carIds ?? [])];
    if (!carIds.length) {
      throw new Error('Select at least one car for the championship.');
    }

    let pointSystem = input.pointSystem;
    if (!pointSystem?.length) {
      const scoring = await this.provider.scoringSystems.getById(
        input.scoringSystemId
      );
      if (!scoring) throw new Error('Scoring system not found.');
      pointSystem = scoring.points;
    }

    let seriesId: string = crypto.randomUUID();
    let editionNumber = 1;

    if (input.successionOfId) {
      const previous = await this.getById(input.successionOfId);
      if (!previous) throw new Error('Previous championship not found.');
      seriesId = previous.seriesId;
      const siblings = await this.listBySeries(seriesId);
      editionNumber =
        Math.max(...siblings.map((s) => s.editionNumber), 0) + 1;
      if (previous.isActive) {
        await this.finalizeChampionship(previous.id);
      }
    }

    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('championships')
      .insert({
        name: input.name,
        season: input.season,
        series_id: seriesId,
        edition_number: editionNumber,
        point_system: pointSystem,
        use_garage: input.useGarage,
        use_events: input.useEvents,
        use_press: input.usePress,
        use_sponsorship: input.useSponsorship,
        scoring_system_id: input.scoringSystemId,
        is_active: true,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);

    const championship = mapChampionship(data as Record<string, unknown>);
    try {
      const { error: carsError } = await client
        .from('championship_cars')
        .insert(
          carIds.map((carId) => ({
            championship_id: championship.id,
            car_id: carId,
          }))
        );
      if (carsError) throw new Error(carsError.message);
      await this.insertCalendar(championship.id, input.calendar);
    } catch (err) {
      // Cascades remove championship_cars / races.
      await client.from('championships').delete().eq('id', championship.id);
      throw err;
    }
    return championship;
  }

  async update(
    id: string,
    input: ChampionshipUpdateInput
  ): Promise<Championship> {
    const existing = await this.getById(id);
    if (!existing) throw new Error('Championship not found.');

    const { data, error } = await this.supabase
      .getClient()
      .from('championships')
      .update({
        name: input.name,
        season: input.season,
        point_system: input.pointSystem,
        use_garage: input.useGarage,
        use_events: input.useEvents,
        use_press: input.usePress,
        use_sponsorship: input.useSponsorship,
        scoring_system_id: input.scoringSystemId,
        is_active: input.isActive,
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapChampionship(data as Record<string, unknown>);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('championships')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  async finalizeChampionship(id: string): Promise<Championship> {
    const { data, error } = await this.supabase
      .getClient()
      .from('championships')
      .update({
        is_active: false,
        finished_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapChampionship(data as Record<string, unknown>);
  }

  async listBySeries(seriesId: string): Promise<Championship[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('championships')
      .select('*')
      .eq('series_id', seriesId)
      .order('edition_number', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) =>
      mapChampionship(row as Record<string, unknown>)
    );
  }

  async listRaces(championshipId: string): Promise<Race[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('races')
      .select('*')
      .eq('championship_id', championshipId)
      .order('round_number', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapRace(row as Record<string, unknown>));
  }

  async listPlannedRaces(championshipId: string): Promise<Race[]> {
    const races = await this.listRaces(championshipId);
    return races.filter((r) => r.status === 'planned');
  }

  async updatePlannedRaceTrack(
    raceId: string,
    trackId: string | null
  ): Promise<Race> {
    const { data, error } = await this.supabase
      .getClient()
      .from('races')
      .update({ track_id: trackId })
      .eq('id', raceId)
      .eq('status', 'planned')
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapRace(data as Record<string, unknown>);
  }

  async addPlannedRounds(
    championshipId: string,
    rounds: PlannedRoundInput[]
  ): Promise<void> {
    await this.insertCalendar(championshipId, rounds);
  }

  async getStandings(championshipId: string): Promise<StandingRow[]> {
    const championship = await this.getById(championshipId);
    if (!championship) return [];

    const [races, entries] = await Promise.all([
      this.listRaces(championshipId),
      this.listEntryRows(championshipId),
    ]);
    return this.buildStandings(
      races.filter((r) => r.status === 'completed'),
      this.identitiesFromEntries(entries),
      entries.map((e) => e.driverId)
    );
  }

  async getConstructorStandings(
    championshipId: string
  ): Promise<ConstructorStandingRow[]> {
    const [races, carIds, cars] = await Promise.all([
      this.listRaces(championshipId),
      this.listCars(championshipId),
      this.provider.cars.list(),
    ]);
    const completed = races.filter((r) => r.status === 'completed');
    const resultsByRace = await this.listResultsByRaceIds(
      completed.map((r) => r.id)
    );
    const carMap = new Map(cars.map((c) => [c.id, c]));
    const byCar = new Map<string, ConstructorStandingRow>();
    const rowFor = (carId: string): ConstructorStandingRow | null => {
      const existing = byCar.get(carId);
      if (existing) return existing;
      const car = carMap.get(carId);
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

    for (const carId of carIds) rowFor(carId);
    for (const results of resultsByRace.values()) {
      for (const result of results) {
        const row = rowFor(result.carId);
        if (!row) continue;
        row.points += result.pointsAwarded;
        row.races += 1;
        if (result.position === 1) row.wins += 1;
        if (result.position <= 3) row.podiums += 1;
      }
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

    const [races, entries] = await Promise.all([
      this.listRaces(championshipId),
      this.listEntryRows(championshipId),
    ]);
    const standings = await this.buildStandings(
      races.filter((r) => r.status === 'completed'),
      this.identitiesFromEntries(entries),
      entries.map((e) => e.driverId)
    );
    return computeTitleContention({
      standings,
      remainingPlanned: races.filter((r) => OPEN_RACE_STATUSES.has(r.status))
        .length,
      gridSize: Math.max(entries.length, standings.length),
      pointSystem: championship.pointSystem,
    });
  }

  async getPreviousSeriesChampionDriverId(
    seriesId: string,
    beforeEditionNumber: number
  ): Promise<string | null> {
    const editions = (await this.listBySeries(seriesId))
      .filter(
        (c) =>
          c.editionNumber < beforeEditionNumber &&
          (!c.isActive || !!c.finishedAt)
      )
      .sort((a, b) => b.editionNumber - a.editionNumber);
    for (const edition of editions) {
      const champion = this.championOf(await this.getStandings(edition.id));
      if (champion) return champion.driverId;
    }
    return null;
  }

  async listCars(championshipId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('championship_cars')
      .select('car_id')
      .eq('championship_id', championshipId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) =>
      String((row as { car_id: string }).car_id)
    );
  }

  async listEntries(championshipId: string): Promise<ChampionshipEntry[]> {
    const entries = await this.listEntryRows(championshipId);
    if (!entries.length) return [];

    const { data, error } = await this.supabase
      .getClient()
      .from('championship_entry_upgrades')
      .select('entry_id, garage_upgrade_id')
      .in(
        'entry_id',
        entries.map((e) => e.id)
      );
    if (error) throw new Error(error.message);

    const byEntry = new Map<string, string[]>();
    for (const row of data ?? []) {
      const record = row as Record<string, unknown>;
      const entryId = String(record['entry_id']);
      const list = byEntry.get(entryId) ?? [];
      list.push(String(record['garage_upgrade_id']));
      byEntry.set(entryId, list);
    }
    return entries.map((entry) => ({
      ...entry,
      garageUpgradeIds: byEntry.get(entry.id) ?? [],
    }));
  }

  async upsertEntry(
    championshipId: string,
    input: ChampionshipEntryInput
  ): Promise<ChampionshipEntry> {
    const championship = await this.getById(championshipId);
    if (!championship) throw new Error('Championship not found.');

    const abbreviation = input.abbreviation.trim().toUpperCase();
    if (abbreviation.length !== 3) {
      throw new Error('Abbreviation must be exactly 3 characters.');
    }
    if (
      !Number.isInteger(input.number) ||
      input.number < 0 ||
      input.number > 99
    ) {
      throw new Error('Number must be an integer between 0 and 99.');
    }

    const carIds = await this.listCars(championshipId);
    if (!carIds.includes(input.carId)) {
      throw new Error('Car is not part of this championship.');
    }

    const client = this.supabase.getClient();
    const row = {
      championship_id: championshipId,
      driver_id: input.driverId,
      car_id: input.carId,
      number: input.number,
      abbreviation,
    };
    const { data: existing, error: lookupError } = await client
      .from('championship_entries')
      .select('id')
      .eq('championship_id', championshipId)
      .eq('driver_id', input.driverId)
      .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);

    const query = existing
      ? client
          .from('championship_entries')
          .update(row)
          .eq('id', String((existing as { id: string }).id))
      : client.from('championship_entries').insert(row);
    const { data, error } = await query.select('*').single();
    if (error) throw new Error(error.message);

    const saved = data as Record<string, unknown>;
    if (input.garageUpgradeIds) {
      return this.setEntryUpgrades(
        championshipId,
        String(saved['id']),
        input.garageUpgradeIds
      );
    }
    const entries = await this.listEntries(championshipId);
    const found = entries.find((e) => e.id === String(saved['id']));
    return found ?? mapChampionshipEntry(saved);
  }

  async removeEntry(championshipId: string, entryId: string): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('championship_entries')
      .delete()
      .eq('id', entryId)
      .eq('championship_id', championshipId);
    if (error) throw new Error(error.message);
  }

  async setEntryUpgrades(
    championshipId: string,
    entryId: string,
    garageUpgradeIds: string[]
  ): Promise<ChampionshipEntry> {
    const championship = await this.getById(championshipId);
    if (!championship) throw new Error('Championship not found.');
    if (!championship.isActive || championship.finishedAt) {
      throw new Error('Garage upgrades are locked once a championship is finalized.');
    }

    const client = this.supabase.getClient();
    const { data: entryRow, error: entryError } = await client
      .from('championship_entries')
      .select('*')
      .eq('id', entryId)
      .eq('championship_id', championshipId)
      .maybeSingle();
    if (entryError) throw new Error(entryError.message);
    if (!entryRow) throw new Error('Championship entry not found.');

    const uniqueIds = [...new Set(garageUpgradeIds)];
    const removed = await client
      .from('championship_entry_upgrades')
      .delete()
      .eq('entry_id', entryId);
    if (removed.error) throw new Error(removed.error.message);
    if (uniqueIds.length) {
      const { error } = await client
        .from('championship_entry_upgrades')
        .insert(
          uniqueIds.map((garageUpgradeId) => ({
            entry_id: entryId,
            garage_upgrade_id: garageUpgradeId,
          }))
        );
      if (error) throw new Error(error.message);
    }
    return mapChampionshipEntry(entryRow as Record<string, unknown>, uniqueIds);
  }

  /**
   * Cumulative points and per-race finishes after each completed round.
   * Used by standings chart and calendar finish matrix.
   */
  async getProgression(
    championshipId: string
  ): Promise<ChampionshipProgression> {
    const allRaces = await this.listRaces(championshipId);
    const completed = allRaces
      .filter((r) => r.status === 'completed')
      .sort((a, b) => (a.roundNumber ?? 0) - (b.roundNumber ?? 0));

    if (!completed.length) {
      return { rounds: [], series: [] };
    }

    const resultsByRace = await this.listResultsByRaceIds(
      completed.map((r) => r.id)
    );
    const [drivers, cars, entries] = await Promise.all([
      this.provider.drivers.list(),
      this.provider.cars.list(),
      this.listEntryRows(championshipId),
    ]);
    const identities = this.identitiesFromEntries(entries);
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

    const rounds = completed.map((race) => ({
      raceId: race.id,
      roundNumber: race.roundNumber ?? 0,
      trackId: race.trackId,
    }));

    const pointsAfter = new Map<string, number[]>();
    const finishByRound = new Map<string, Array<number | null>>();

    for (let i = 0; i < completed.length; i++) {
      const race = completed[i];
      const results = resultsByRace.get(race.id) ?? [];
      const finishThisRound = new Map<string, number>();

      for (const result of results) {
        const driver = drivers.find((d) => d.id === result.driverId);
        if (!driver) continue;
        const identity =
          identities.get(driver.id) ?? fallbackDriverIdentity(driver.name);
        const current = totals.get(result.driverId) ?? {
          points: 0,
          name: driver.name,
          nickname: driver.nickname,
          abbreviation: identity.abbreviation,
          number: identity.number,
        };
        current.points += result.pointsAwarded;
        totals.set(result.driverId, current);
        finishThisRound.set(result.driverId, result.position);

        const usage = carUsage.get(result.driverId) ?? new Map<string, number>();
        usage.set(result.carId, (usage.get(result.carId) ?? 0) + 1);
        carUsage.set(result.driverId, usage);

        if (!pointsAfter.has(result.driverId)) {
          pointsAfter.set(result.driverId, Array(i).fill(0));
          finishByRound.set(result.driverId, Array(i).fill(null));
        }
      }

      for (const [driverId] of totals) {
        const pts = pointsAfter.get(driverId) ?? Array(i).fill(0);
        const finishes = finishByRound.get(driverId) ?? Array(i).fill(null);
        while (pts.length < i) pts.push(pts[pts.length - 1] ?? 0);
        while (finishes.length < i) finishes.push(null);
        pts.push(totals.get(driverId)!.points);
        finishes.push(finishThisRound.get(driverId) ?? null);
        pointsAfter.set(driverId, pts);
        finishByRound.set(driverId, finishes);
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
          finishByRound.get(driverId) ?? [],
          completed.length,
          null
        ),
      })
    );

    series.sort((a, b) => {
      const ap = a.pointsAfterRound[a.pointsAfterRound.length - 1] ?? 0;
      const bp = b.pointsAfterRound[b.pointsAfterRound.length - 1] ?? 0;
      return bp - ap;
    });

    return { rounds, series };
  }

  private resolveMostUsedCarColor(
    usage: Map<string, number> | undefined,
    cars: { id: string; colorHex: string }[],
    fallbackIndex: number
  ): string {
    if (usage?.size) {
      const bestCarId = [...usage.entries()].sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
      })[0]?.[0];
      const car = cars.find((c) => c.id === bestCarId);
      if (car?.colorHex) return car.colorHex;
    }
    return CAR_COLORS[fallbackIndex % CAR_COLORS.length].hex;
  }

  async listResultsByRaceIds(
    raceIds: string[]
  ): Promise<Map<string, RaceResult[]>> {
    const map = new Map<string, RaceResult[]>();
    if (!raceIds.length) return map;

    const { data, error } = await this.supabase
      .getClient()
      .from('race_results')
      .select('*')
      .in('race_id', raceIds);
    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      const result = mapRaceResult(row as Record<string, unknown>);
      const list = map.get(result.raceId) ?? [];
      list.push(result);
      map.set(result.raceId, list);
    }

    for (const [raceId, list] of map) {
      map.set(
        raceId,
        list.sort((a, b) => a.position - b.position)
      );
    }
    return map;
  }

  private padNumberSeries(values: number[], length: number): number[] {
    if (values.length >= length) return values.slice(0, length);
    const last = values[values.length - 1] ?? 0;
    return [...values, ...Array(length - values.length).fill(last)];
  }

  private padNullableSeries(
    values: Array<number | null>,
    length: number,
    fill: number | null = null
  ): Array<number | null> {
    if (values.length >= length) return values.slice(0, length);
    return [...values, ...Array(length - values.length).fill(fill)];
  }

  private padBooleanSeries(values: boolean[], length: number): boolean[] {
    if (values.length >= length) return values.slice(0, length);
    return [...values, ...Array(length - values.length).fill(false)];
  }

  async getOverallStandings(): Promise<StandingRow[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('races')
      .select('*')
      .eq('status', 'completed');
    if (error) throw new Error(error.message);
    const races = (data ?? []).map((row) =>
      mapRace(row as Record<string, unknown>)
    );
    return this.buildStandings(races);
  }

  async getSeriesChampions(seriesId: string): Promise<SeriesChampionRow[]> {
    const editions = await this.listBySeries(seriesId);
    const [drivers, cars] = await Promise.all([
      this.provider.drivers.list(),
      this.provider.cars.list(),
    ]);
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
        const standings = await this.getStandings(edition.id);
        const champ = this.championOf(standings);
        if (champ) {
          const car = await this.bestCarForDriverInChampionship(
            edition.id,
            champ.driverId
          );
          const carEntity = car
            ? cars.find((c) => c.id === car.carId)
            : undefined;
          rows.push({
            ...base,
            driverId: champ.driverId,
            driverName: formatDriverName({
              name: champ.driverName,
              nickname: champ.nickname,
            }),
            nickname: champ.nickname,
            carId: car?.carId,
            carName: carEntity?.name ?? car?.carName,
            carColorHex: carEntity?.colorHex,
            points: champ.points,
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
      (c) => !c.isActive || !!c.finishedAt
    );
    const [drivers, identities] = await Promise.all([
      this.provider.drivers.list(),
      loadLatestDriverIdentities(this.supabase),
    ]);
    const tally = new Map<
      string,
      { titles: number; lastSeason?: string; lastEdition: number; lastCar?: string }
    >();

    for (const championship of championships) {
      const standings = await this.getStandings(championship.id);
      const champ = this.championOf(standings);
      if (!champ) continue;
      const car = await this.bestCarForDriverInChampionship(
        championship.id,
        champ.driverId
      );
      const current = tally.get(champ.driverId) ?? {
        titles: 0,
        lastEdition: -1,
      };
      current.titles += 1;
      if (championship.editionNumber >= current.lastEdition) {
        current.lastEdition = championship.editionNumber;
        current.lastSeason = championship.season;
        current.lastCar = car?.carName;
      }
      tally.set(champ.driverId, current);
    }

    const rows: GlobalChampionRow[] = [];
    for (const driver of drivers) {
      const stats = tally.get(driver.id);
      if (!stats) continue;
      const identity =
        identities.get(driver.id) ?? fallbackDriverIdentity(driver.name);
      rows.push({
        driverId: driver.id,
        driverName: formatDriverName(driver),
        nickname: driver.nickname,
        abbreviation: identity.abbreviation,
        number: identity.number,
        isLegend: driver.isLegend,
        titles: stats.titles,
        lastTitleSeason: stats.lastSeason,
        lastTitleCarName: stats.lastCar,
      });
    }
    return rows.sort((a, b) => {
      if (b.titles !== a.titles) return b.titles - a.titles;
      return (b.lastTitleSeason ?? '').localeCompare(a.lastTitleSeason ?? '');
    });
  }

  async getDriverTitles(driverId: string): Promise<TitleWin[]> {
    const championships = (await this.list()).filter(
      (c) => !c.isActive || !!c.finishedAt
    );
    const wins: TitleWin[] = [];
    for (const championship of championships) {
      const standings = await this.getStandings(championship.id);
      if (this.championOf(standings)?.driverId !== driverId) continue;
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
      (c) => !c.isActive || !!c.finishedAt
    );
    const drivers = await this.provider.drivers.list();
    const wins: TitleWin[] = [];
    for (const championship of championships) {
      const standings = await this.getStandings(championship.id);
      const champ = this.championOf(standings);
      if (!champ) continue;
      const car = await this.bestCarForDriverInChampionship(
        championship.id,
        champ.driverId
      );
      if (car?.carId !== carId) continue;
      const driver = drivers.find((d) => d.id === champ.driverId);
      wins.push({
        championshipId: championship.id,
        championshipName: championship.name,
        season: championship.season,
        editionNumber: championship.editionNumber,
        carId,
        carName: car.carName,
        driverId: champ.driverId,
        driverName: driver ? formatDriverName(driver) : champ.driverName,
      });
    }
    return wins.sort((a, b) => b.editionNumber - a.editionNumber);
  }

  /** Leader only counts as champion once they have actually raced. */
  private championOf(standings: StandingRow[]): StandingRow | undefined {
    const leader = standings[0];
    return leader && leader.races > 0 ? leader : undefined;
  }

  /** Entry rows without garage upgrades (cheap; used for identity/car lookup). */
  private async listEntryRows(
    championshipId: string
  ): Promise<ChampionshipEntry[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('championship_entries')
      .select('*')
      .eq('championship_id', championshipId)
      .order('number', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) =>
      mapChampionshipEntry(row as Record<string, unknown>)
    );
  }

  private identitiesFromEntries(
    entries: ChampionshipEntry[]
  ): Map<string, DriverIdentity> {
    return new Map(
      entries.map((e) => [
        e.driverId,
        { abbreviation: e.abbreviation, number: e.number },
      ])
    );
  }

  private async insertCalendar(
    championshipId: string,
    calendar: PlannedRoundInput[]
  ): Promise<void> {
    const rows = calendar.map((round) => ({
      championship_id: championshipId,
      track_id: round.trackId || null,
      round_number: round.roundNumber,
      race_type: 'championship',
      status: 'planned',
    }));
    const { error } = await this.supabase.getClient().from('races').insert(rows);
    if (error) throw new Error(error.message);
  }

  /**
   * Aggregates completed races into sorted standings (points → P1 → P2 → P3 → latest win).
   * `identities` are championship-scoped number/abbreviation; when omitted the latest
   * entry per driver is used (cross-championship views).
   * `seedDriverIds` get a zero row even before they have raced.
   */
  private async buildStandings(
    races: Race[],
    identities?: Map<string, DriverIdentity>,
    seedDriverIds: string[] = []
  ): Promise<StandingRow[]> {
    if (!races.length && !seedDriverIds.length) return [];

    const raceIds = races.map((r) => r.id);
    const roundByRace = new Map(races.map((r) => [r.id, r.roundNumber]));
    const resultsByRace = await this.listResultsByRaceIds(raceIds);
    const [drivers, resolvedIdentities] = await Promise.all([
      this.provider.drivers.list(),
      identities ? Promise.resolve(identities) : loadLatestDriverIdentities(this.supabase),
    ]);
    const driverMap = new Map(drivers.map((d) => [d.id, d]));
    const byDriver = new Map<string, StandingAccum>();

    const rowFor = (driverId: string): StandingAccum | null => {
      const existing = byDriver.get(driverId);
      if (existing) return existing;
      const driver = driverMap.get(driverId);
      if (!driver) return null;
      const identity =
        resolvedIdentities.get(driverId) ?? fallbackDriverIdentity(driver.name);
      const row = emptyStandingAccum({
        driverId: driver.id,
        driverName: driver.name,
        nickname: driver.nickname,
        abbreviation: identity.abbreviation,
        number: identity.number,
      });
      byDriver.set(driverId, row);
      return row;
    };

    for (const driverId of seedDriverIds) rowFor(driverId);
    for (const [raceId, results] of resultsByRace) {
      const roundNumber = roundByRace.get(raceId);
      for (const result of results) {
        const row = rowFor(result.driverId);
        if (!row) continue;
        applyResultToStanding(row, result, roundNumber);
      }
    }

    return sortStandingRows([...byDriver.values()]);
  }

  private async bestCarForDriverInChampionship(
    championshipId: string,
    driverId: string
  ): Promise<{ carId: string; carName: string } | null> {
    // Championship entries pin one car per driver.
    const entry = (await this.listEntryRows(championshipId)).find(
      (e) => e.driverId === driverId
    );
    if (entry) {
      const car = (await this.provider.cars.list()).find(
        (c) => c.id === entry.carId
      );
      if (car) return { carId: car.id, carName: car.name };
    }

    const races = (await this.listRaces(championshipId)).filter(
      (r) => r.status === 'completed'
    );
    if (!races.length) return null;
    const { data, error } = await this.supabase
      .getClient()
      .from('race_results')
      .select('*')
      .eq('driver_id', driverId)
      .in(
        'race_id',
        races.map((r) => r.id)
      );
    if (error) throw new Error(error.message);
    const results = (data ?? []).map((row) =>
      mapRaceResult(row as Record<string, unknown>)
    );
    if (!results.length) return null;

    const byCar = new Map<string, number>();
    for (const result of results) {
      byCar.set(
        result.carId,
        (byCar.get(result.carId) ?? 0) + result.pointsAwarded
      );
    }
    const bestCarId = [...byCar.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!bestCarId) return null;
    const cars = await this.provider.cars.list();
    const car = cars.find((c) => c.id === bestCarId);
    return car ? { carId: car.id, carName: car.name } : null;
  }
}

