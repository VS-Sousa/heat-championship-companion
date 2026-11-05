import { Injectable } from '@angular/core';
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
} from '../models/domain.models';
import { mapChampionship, mapRace, mapRaceResult } from './mappers';
import { SupabaseService } from './supabase.service';
import { DriversService } from './drivers.service';
import { CarsService } from './cars.service';
import { formatDriverName } from '../utils/driver-display';
import { CAR_COLORS } from '../utils/car-colors';

@Injectable({ providedIn: 'root' })
export class ChampionshipsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly driversService: DriversService,
    private readonly carsService: CarsService
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
        point_system: input.pointSystem,
        use_garage: input.useGarage,
        use_events: input.useEvents,
        use_press: input.usePress,
        use_sponsorship: input.useSponsorship,
        is_active: true,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);

    const championship = mapChampionship(data as Record<string, unknown>);
    await this.insertCalendar(championship.id, input.calendar);
    return championship;
  }

  async update(
    id: string,
    input: Omit<
      Championship,
      'id' | 'seriesId' | 'editionNumber' | 'finishedAt'
    > & { seriesId?: string; editionNumber?: number }
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

    const races = (await this.listRaces(championshipId)).filter(
      (r) => r.status === 'completed'
    );
    const standings = await this.aggregateStandings(races.map((r) => r.id));
    const remaining = (await this.listRaces(championshipId)).filter(
      (r) => r.status === 'planned'
    ).length;
    return this.applyTitleFight(standings, championship.pointSystem, remaining);
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
    const [drivers, cars] = await Promise.all([
      this.driversService.list(),
      this.carsService.list(),
    ]);
    const totals = new Map<
      string,
      {
        points: number;
        wins: number;
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
    const dnfByRound = new Map<string, boolean[]>();

    for (let i = 0; i < completed.length; i++) {
      const race = completed[i];
      const results = resultsByRace.get(race.id) ?? [];
      const finishThisRound = new Map<string, { position: number; dnf: boolean }>();

      for (const result of results) {
        const driver = drivers.find((d) => d.id === result.driverId);
        if (!driver) continue;
        const current = totals.get(result.driverId) ?? {
          points: 0,
          wins: 0,
          name: driver.name,
          nickname: driver.nickname,
          abbreviation: driver.abbreviation,
          number: driver.number,
        };
        current.points += result.pointsAwarded;
        if (!result.dnf && result.position === 1) current.wins += 1;
        totals.set(result.driverId, current);
        finishThisRound.set(result.driverId, {
          position: result.position,
          dnf: result.dnf,
        });

        const usage = carUsage.get(result.driverId) ?? new Map<string, number>();
        usage.set(result.carId, (usage.get(result.carId) ?? 0) + 1);
        carUsage.set(result.driverId, usage);

        if (!pointsAfter.has(result.driverId)) {
          pointsAfter.set(result.driverId, Array(i).fill(0));
          finishByRound.set(result.driverId, Array(i).fill(null));
          dnfByRound.set(result.driverId, Array(i).fill(false));
        }
      }

      for (const [driverId] of totals) {
        const pts = pointsAfter.get(driverId) ?? Array(i).fill(0);
        const finishes = finishByRound.get(driverId) ?? Array(i).fill(null);
        const dnfs = dnfByRound.get(driverId) ?? Array(i).fill(false);
        while (pts.length < i) pts.push(pts[pts.length - 1] ?? 0);
        while (finishes.length < i) finishes.push(null);
        while (dnfs.length < i) dnfs.push(false);
        pts.push(totals.get(driverId)!.points);
        const finish = finishThisRound.get(driverId);
        finishes.push(finish?.position ?? null);
        dnfs.push(finish?.dnf ?? false);
        pointsAfter.set(driverId, pts);
        finishByRound.set(driverId, finishes);
        dnfByRound.set(driverId, dnfs);
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
        dnfByRound: this.padBooleanSeries(
          dnfByRound.get(driverId) ?? [],
          completed.length
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
    return this.aggregateStandings(races.map((r) => r.id));
  }

  async getSeriesChampions(seriesId: string): Promise<SeriesChampionRow[]> {
    const editions = await this.listBySeries(seriesId);
    const [drivers, cars] = await Promise.all([
      this.driversService.list(),
      this.carsService.list(),
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
        const champ = standings[0];
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
    const drivers = await this.driversService.list();
    const tally = new Map<
      string,
      { titles: number; lastSeason?: string; lastEdition: number; lastCar?: string }
    >();

    for (const championship of championships) {
      const standings = await this.getStandings(championship.id);
      const champ = standings[0];
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
      rows.push({
        driverId: driver.id,
        driverName: formatDriverName(driver),
        nickname: driver.nickname,
        abbreviation: driver.abbreviation,
        number: driver.number,
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
      if (standings[0]?.driverId !== driverId) continue;
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
    const drivers = await this.driversService.list();
    const wins: TitleWin[] = [];
    for (const championship of championships) {
      const standings = await this.getStandings(championship.id);
      const champ = standings[0];
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

  private async aggregateStandings(raceIds: string[]): Promise<StandingRow[]> {
    if (!raceIds.length) return [];

    const { data: resultsRaw, error } = await this.supabase
      .getClient()
      .from('race_results')
      .select('*')
      .in('race_id', raceIds);
    if (error) throw new Error(error.message);

    const results = (resultsRaw ?? []).map((row) =>
      mapRaceResult(row as Record<string, unknown>)
    );
    const drivers = await this.driversService.list();
    const byDriver = new Map<string, StandingRow>();

    for (const result of results) {
      const driver = drivers.find((d) => d.id === result.driverId);
      if (!driver) continue;

      const current = byDriver.get(result.driverId) ?? {
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
      byDriver.set(result.driverId, current);
    }

    return [...byDriver.values()].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.driverName.localeCompare(b.driverName);
    });
  }

  private async bestCarForDriverInChampionship(
    championshipId: string,
    driverId: string
  ): Promise<{ carId: string; carName: string } | null> {
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
    const cars = await this.carsService.list();
    const car = cars.find((c) => c.id === bestCarId);
    return car ? { carId: car.id, carName: car.name } : null;
  }
}
