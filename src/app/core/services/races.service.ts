import { Injectable } from '@angular/core';
import {
  CarStatRow,
  DriverStatRow,
  LogRaceRequest,
  Race,
  RaceResult,
} from '../models/domain.models';
import { mapRace, mapRaceResult } from './mappers';
import { SupabaseService } from './supabase.service';
import { DriversService } from './drivers.service';
import { CarsService } from './cars.service';

@Injectable({ providedIn: 'root' })
export class RacesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly driversService: DriversService,
    private readonly carsService: CarsService
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

  async logRace(request: LogRaceRequest): Promise<Race> {
    this.validateResults(request.results);

    const client = this.supabase.getClient();
    const { data: raceRaw, error: raceError } = await client
      .from('races')
      .insert({
        championship_id: request.championshipId ?? null,
        track_id: request.trackId,
        round_number: request.roundNumber ?? null,
        race_type: request.raceType,
        weather_condition: request.weatherCondition ?? null,
      })
      .select('*')
      .single();

    if (raceError) throw new Error(raceError.message);
    const race = mapRace(raceRaw as Record<string, unknown>);

    const rows = request.results.map((result) => ({
      race_id: race.id,
      driver_id: result.driverId,
      car_id: result.carId,
      grid_position: result.gridPosition,
      position: result.position,
      points_awarded: result.pointsAwarded,
      dnf: result.dnf,
    }));

    const { error: resultsError } = await client
      .from('race_results')
      .insert(rows);
    if (resultsError) {
      await client.from('races').delete().eq('id', race.id);
      throw new Error(resultsError.message);
    }

    return race;
  }

  async getDriverStats(): Promise<DriverStatRow[]> {
    const [drivers, results] = await Promise.all([
      this.driversService.list(),
      this.listAllResults(),
    ]);

    return drivers
      .map((driver) => {
        const owned = results.filter((r) => r.driverId === driver.id);
        const finishes = owned.filter((r) => !r.dnf);
        const avgFinish =
          finishes.length > 0
            ? finishes.reduce((sum, r) => sum + r.position, 0) / finishes.length
            : null;

        return {
          driverId: driver.id,
          driverName: driver.name,
          abbreviation: driver.abbreviation,
          number: driver.number,
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
    const [cars, results] = await Promise.all([
      this.carsService.list(),
      this.listAllResults(),
    ]);

    return cars
      .map((car) => {
        const owned = results.filter((r) => r.carId === car.id);
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

  pointsForPosition(pointSystem: number[], position: number, dnf: boolean): number {
    if (dnf) return 0;
    return pointSystem[position - 1] ?? 0;
  }

  validateResults(
    results: LogRaceRequest['results']
  ): void {
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
}
