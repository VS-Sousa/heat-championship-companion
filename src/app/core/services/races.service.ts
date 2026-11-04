import { Injectable } from '@angular/core';
import {
  BreakdownStatRow,
  CarStatRow,
  CompletePlannedRaceRequest,
  DriverStatRow,
  HeadToHeadRow,
  LogStandaloneRaceRequest,
  Race,
  RaceResult,
  ResultHistoryRow,
  TrackDriverHistoryRow,
} from '../models/domain.models';
import { mapRace, mapRaceResult } from './mappers';
import { SupabaseService } from './supabase.service';
import { DriversService } from './drivers.service';
import { CarsService } from './cars.service';
import { TracksService } from './tracks.service';
import { formatDriverName } from '../utils/driver-display';

@Injectable({ providedIn: 'root' })
export class RacesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly driversService: DriversService,
    private readonly carsService: CarsService,
    private readonly tracksService: TracksService
  ) {}

  async listRecent(limit = 10): Promise<Race[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('races')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapRace(row as Record<string, unknown>));
  }

  async getRace(id: string): Promise<Race | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('races')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapRace(data as Record<string, unknown>) : null;
  }

  async listResultsByRace(raceId: string): Promise<RaceResult[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('race_results')
      .select('*')
      .eq('race_id', raceId)
      .order('position');
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) =>
      mapRaceResult(row as Record<string, unknown>)
    );
  }

  async completePlannedRace(
    request: CompletePlannedRaceRequest
  ): Promise<Race> {
    this.validateResults(request.results);
    const client = this.supabase.getClient();

    const { data: raceRaw, error: raceError } = await client
      .from('races')
      .update({
        track_id: request.trackId,
        weather_condition: request.weatherCondition ?? null,
        track_condition: request.trackCondition ?? null,
        raced_at: request.racedAt,
        status: 'completed',
      })
      .eq('id', request.raceId)
      .eq('status', 'planned')
      .select('*')
      .single();
    if (raceError) throw new Error(raceError.message);

    const race = mapRace(raceRaw as Record<string, unknown>);
    await this.insertResults(race.id, request.results);
    return race;
  }

  async logStandaloneRace(request: LogStandaloneRaceRequest): Promise<Race> {
    this.validateResults(request.results);
    const client = this.supabase.getClient();

    const { data: raceRaw, error: raceError } = await client
      .from('races')
      .insert({
        championship_id: null,
        track_id: request.trackId,
        race_type: 'standalone',
        status: 'completed',
        weather_condition: request.weatherCondition ?? null,
        track_condition: request.trackCondition ?? null,
        raced_at: request.racedAt,
      })
      .select('*')
      .single();
    if (raceError) throw new Error(raceError.message);

    const race = mapRace(raceRaw as Record<string, unknown>);
    try {
      await this.insertResults(race.id, request.results);
    } catch (err) {
      await client.from('races').delete().eq('id', race.id);
      throw err;
    }
    return race;
  }

  async cancelRace(raceId: string): Promise<Race> {
    const { data, error } = await this.supabase
      .getClient()
      .from('races')
      .update({ status: 'cancelled' })
      .eq('id', raceId)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapRace(data as Record<string, unknown>);
  }

  async getDriverStats(): Promise<DriverStatRow[]> {
    const [drivers, completedRaceIds, results] = await Promise.all([
      this.driversService.list(),
      this.listCompletedRaceIds(),
      this.listAllResults(),
    ]);
    const completed = new Set(completedRaceIds);

    return drivers
      .map((driver) => {
        const owned = results.filter(
          (r) => r.driverId === driver.id && completed.has(r.raceId)
        );
        const finishes = owned.filter((r) => !r.dnf);
        const avgFinish =
          finishes.length > 0
            ? finishes.reduce((sum, r) => sum + r.position, 0) / finishes.length
            : null;

        return {
          driverId: driver.id,
          driverName: formatDriverName(driver),
          nickname: driver.nickname,
          abbreviation: driver.abbreviation,
          number: driver.number,
          isLegend: driver.isLegend,
          races: owned.length,
          wins: finishes.filter((r) => r.position === 1).length,
          podiums: finishes.filter((r) => r.position <= 3).length,
          dnfs: owned.filter((r) => r.dnf).length,
          avgFinish,
        };
      })
      .sort((a, b) => b.wins - a.wins || b.podiums - a.podiums);
  }

  async getCarStats(): Promise<CarStatRow[]> {
    const [cars, completedRaceIds, results] = await Promise.all([
      this.carsService.list(),
      this.listCompletedRaceIds(),
      this.listAllResults(),
    ]);
    const completed = new Set(completedRaceIds);

    return cars
      .map((car) => {
        const owned = results.filter(
          (r) => r.carId === car.id && completed.has(r.raceId)
        );
        const finishes = owned.filter((r) => !r.dnf);
        return {
          carId: car.id,
          carName: car.name,
          colorHex: car.colorHex,
          races: owned.length,
          wins: finishes.filter((r) => r.position === 1).length,
          podiums: finishes.filter((r) => r.position <= 3).length,
          dnfs: owned.filter((r) => r.dnf).length,
        };
      })
      .sort((a, b) => b.wins - a.wins || b.races - a.races);
  }

  async getDriverResultHistory(driverId: string): Promise<ResultHistoryRow[]> {
    return this.buildHistory({ driverId });
  }

  async getCarResultHistory(carId: string): Promise<ResultHistoryRow[]> {
    return this.buildHistory({ carId });
  }

  async getDriverBreakdownByCar(driverId: string): Promise<BreakdownStatRow[]> {
    const history = await this.getDriverResultHistory(driverId);
    return this.breakdown(history, (row) => ({
      id: row.carId,
      label: row.carName,
      colorHex: row.carColorHex,
    }));
  }

  async getDriverBreakdownByTrack(
    driverId: string
  ): Promise<BreakdownStatRow[]> {
    const history = await this.getDriverResultHistory(driverId);
    return this.breakdown(history, (row) => ({
      id: row.trackId ?? 'unknown',
      label: row.trackName ?? '—',
    }));
  }

  async getCarBreakdownByDriver(carId: string): Promise<BreakdownStatRow[]> {
    const history = await this.getCarResultHistory(carId);
    return this.breakdown(history, (row) => ({
      id: row.driverId,
      label: row.driverName,
    }));
  }

  async getCarBreakdownByTrack(carId: string): Promise<BreakdownStatRow[]> {
    const history = await this.getCarResultHistory(carId);
    return this.breakdown(history, (row) => ({
      id: row.trackId ?? 'unknown',
      label: row.trackName ?? '—',
    }));
  }

  async getTrackDriverHistory(trackId: string): Promise<TrackDriverHistoryRow[]> {
    const history = (await this.buildHistory({ trackId })).filter(
      (row) => row.trackId === trackId
    );
    const byDriver = new Map<string, TrackDriverHistoryRow>();
    for (const row of history) {
      const current = byDriver.get(row.driverId) ?? {
        driverId: row.driverId,
        driverName: row.driverName,
        races: 0,
        wins: 0,
        podiums: 0,
        avgFinish: null,
        bestFinish: null,
      };
      current.races += 1;
      if (!row.dnf && row.position === 1) current.wins += 1;
      if (!row.dnf && row.position <= 3) current.podiums += 1;
      if (!row.dnf) {
        current.bestFinish =
          current.bestFinish === null
            ? row.position
            : Math.min(current.bestFinish, row.position);
      }
      byDriver.set(row.driverId, current);
    }

    return [...byDriver.values()]
      .map((row) => {
        const finishes = history.filter(
          (h) => h.driverId === row.driverId && !h.dnf
        );
        return {
          ...row,
          avgFinish:
            finishes.length > 0
              ? finishes.reduce((s, h) => s + h.position, 0) / finishes.length
              : null,
        };
      })
      .sort((a, b) => b.wins - a.wins || b.races - a.races);
  }

  async getDriverHeadToHead(driverId: string): Promise<HeadToHeadRow[]> {
    const completedIds = await this.listCompletedRaceIds();
    const results = (await this.listAllResults()).filter((r) =>
      completedIds.includes(r.raceId)
    );
    const drivers = await this.driversService.list();
    const byRace = new Map<string, RaceResult[]>();
    for (const result of results) {
      const list = byRace.get(result.raceId) ?? [];
      list.push(result);
      byRace.set(result.raceId, list);
    }

    const h2h = new Map<string, HeadToHeadRow>();
    for (const raceResults of byRace.values()) {
      const me = raceResults.find((r) => r.driverId === driverId);
      if (!me) continue;
      for (const other of raceResults) {
        if (other.driverId === driverId) continue;
        const opponent = drivers.find((d) => d.id === other.driverId);
        if (!opponent) continue;
        const row = h2h.get(other.driverId) ?? {
          opponentId: other.driverId,
          opponentName: formatDriverName(opponent),
          wins: 0,
          losses: 0,
          draws: 0,
        };
        const myPos = me.dnf ? 999 : me.position;
        const theirPos = other.dnf ? 999 : other.position;
        if (myPos < theirPos) row.wins += 1;
        else if (myPos > theirPos) row.losses += 1;
        else row.draws += 1;
        h2h.set(other.driverId, row);
      }
    }

    return [...h2h.values()].sort(
      (a, b) => b.wins - a.wins || a.losses - b.losses
    );
  }

  async getDriverBestFinish(
    driverId: string
  ): Promise<{ position: number; racedAt?: string; trackName?: string } | null> {
    const history = (await this.getDriverResultHistory(driverId)).filter(
      (r) => !r.dnf
    );
    if (!history.length) return null;
    history.sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      return (b.racedAt ?? '').localeCompare(a.racedAt ?? '');
    });
    const best = history[0];
    return {
      position: best.position,
      racedAt: best.racedAt,
      trackName: best.trackName,
    };
  }

  pointsForPosition(
    pointSystem: number[],
    position: number,
    dnf: boolean
  ): number {
    if (dnf) return 0;
    return pointSystem[position - 1] ?? 0;
  }

  validateResults(results: { driverId: string; carId: string; gridPosition: number; position: number }[]): void {
    if (!results.length) {
      throw new Error('Add at least one driver result.');
    }

    const drivers = new Set<string>();
    const cars = new Set<string>();
    const grids = new Set<number>();
    const positions = new Set<number>();

    for (const result of results) {
      if (drivers.has(result.driverId)) {
        throw new Error('Each driver can only appear once in a race.');
      }
      if (cars.has(result.carId)) {
        throw new Error('Each car can only appear once in a race.');
      }
      if (grids.has(result.gridPosition)) {
        throw new Error('Grid positions must be unique.');
      }
      if (positions.has(result.position)) {
        throw new Error('Finishing positions must be unique.');
      }
      drivers.add(result.driverId);
      cars.add(result.carId);
      grids.add(result.gridPosition);
      positions.add(result.position);
    }
  }

  private async insertResults(
    raceId: string,
    results: CompletePlannedRaceRequest['results']
  ): Promise<void> {
    const rows = results.map((result) => ({
      race_id: raceId,
      driver_id: result.driverId,
      car_id: result.carId,
      grid_position: result.gridPosition,
      position: result.position,
      points_awarded: result.pointsAwarded,
      dnf: result.dnf,
    }));
    const { error } = await this.supabase
      .getClient()
      .from('race_results')
      .insert(rows);
    if (error) throw new Error(error.message);
  }

  private async listAllResults(): Promise<RaceResult[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('race_results')
      .select('*');
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) =>
      mapRaceResult(row as Record<string, unknown>)
    );
  }

  private async listCompletedRaceIds(): Promise<string[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('races')
      .select('id')
      .eq('status', 'completed');
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => String((row as { id: string }).id));
  }

  private async listAllRaces(): Promise<Race[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('races')
      .select('*');
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapRace(row as Record<string, unknown>));
  }

  private async buildHistory(filter: {
    driverId?: string;
    carId?: string;
    trackId?: string;
  }): Promise<ResultHistoryRow[]> {
    const [races, results, drivers, cars, tracks, championshipsRaw] =
      await Promise.all([
        this.listAllRaces(),
        this.listAllResults(),
        this.driversService.list(),
        this.carsService.list(),
        this.tracksService.list(),
        this.supabase.getClient().from('championships').select('id, name'),
      ]);

    if (championshipsRaw.error) throw new Error(championshipsRaw.error.message);
    const championshipNames = new Map(
      (championshipsRaw.data ?? []).map((row) => [
        String((row as { id: string }).id),
        String((row as { name: string }).name),
      ])
    );

    const completed = new Set(
      races.filter((r) => r.status === 'completed').map((r) => r.id)
    );

    const history: ResultHistoryRow[] = [];
    for (const result of results) {
      if (!completed.has(result.raceId)) continue;
      if (filter.driverId && result.driverId !== filter.driverId) continue;
      if (filter.carId && result.carId !== filter.carId) continue;
      const race = races.find((r) => r.id === result.raceId);
      if (!race) continue;
      if (filter.trackId && race.trackId !== filter.trackId) continue;
      const driver = drivers.find((d) => d.id === result.driverId);
      const car = cars.find((c) => c.id === result.carId);
      const track = tracks.find((t) => t.id === race.trackId);
      history.push({
        raceId: result.raceId,
        racedAt: race.racedAt,
        trackId: race.trackId,
        trackName: track?.name,
        championshipId: race.championshipId,
        championshipName: race.championshipId
          ? championshipNames.get(race.championshipId)
          : undefined,
        driverId: result.driverId,
        driverName: driver ? formatDriverName(driver) : result.driverId,
        carId: result.carId,
        carName: car?.name ?? result.carId,
        carColorHex: car?.colorHex,
        gridPosition: result.gridPosition,
        position: result.position,
        pointsAwarded: result.pointsAwarded,
        dnf: result.dnf,
      });
    }
    return history.sort((a, b) =>
      (b.racedAt ?? '').localeCompare(a.racedAt ?? '')
    );
  }

  private breakdown(
    history: ResultHistoryRow[],
    keyFn: (row: ResultHistoryRow) => { id: string; label: string; colorHex?: string }
  ): BreakdownStatRow[] {
    const map = new Map<string, BreakdownStatRow & { finishSum: number; finishCount: number }>();
    for (const row of history) {
      const key = keyFn(row);
      const current = map.get(key.id) ?? {
        id: key.id,
        label: key.label,
        colorHex: key.colorHex,
        races: 0,
        wins: 0,
        podiums: 0,
        points: 0,
        avgFinish: null,
        finishSum: 0,
        finishCount: 0,
      };
      current.races += 1;
      current.points += row.pointsAwarded;
      if (!row.dnf && row.position === 1) current.wins += 1;
      if (!row.dnf && row.position <= 3) current.podiums += 1;
      if (!row.dnf) {
        current.finishSum += row.position;
        current.finishCount += 1;
      }
      map.set(key.id, current);
    }
    return [...map.values()]
      .map(({ finishSum, finishCount, ...rest }) => ({
        ...rest,
        avgFinish: finishCount ? finishSum / finishCount : null,
      }))
      .sort((a, b) => b.points - a.points || b.wins - a.wins);
  }
}
