import { Injectable } from '@angular/core';
import { Championship, StandingRow } from '../models/domain.models';
import { mapChampionship, mapRace, mapRaceResult } from './mappers';
import { SupabaseService } from './supabase.service';
import { DriversService } from './drivers.service';

@Injectable({ providedIn: 'root' })
export class ChampionshipsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly driversService: DriversService
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

  async create(input: Omit<Championship, 'id'>): Promise<Championship> {
    const { data, error } = await this.supabase
      .getClient()
      .from('championships')
      .insert({
        name: input.name,
        season: input.season,
        point_system: input.pointSystem,
        use_garage: input.useGarage,
        use_weather: input.useWeather,
        use_legends: input.useLegends,
        use_heavy_rain: input.useHeavyRain,
        is_active: input.isActive,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapChampionship(data as Record<string, unknown>);
  }

  async update(
    id: string,
    input: Omit<Championship, 'id'>
  ): Promise<Championship> {
    const { data, error } = await this.supabase
      .getClient()
      .from('championships')
      .update({
        name: input.name,
        season: input.season,
        point_system: input.pointSystem,
        use_garage: input.useGarage,
        use_weather: input.useWeather,
        use_legends: input.useLegends,
        use_heavy_rain: input.useHeavyRain,
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

  async getStandings(championshipId: string): Promise<StandingRow[]> {
    const client = this.supabase.getClient();
    const { data: racesRaw, error: racesError } = await client
      .from('races')
      .select('*')
      .eq('championship_id', championshipId);
    if (racesError) throw new Error(racesError.message);

    const races = (racesRaw ?? []).map((row) =>
      mapRace(row as Record<string, unknown>)
    );
    if (!races.length) return [];

    const raceIds = races.map((r) => r.id);
    const { data: resultsRaw, error: resultsError } = await client
      .from('race_results')
      .select('*')
      .in('race_id', raceIds);
    if (resultsError) throw new Error(resultsError.message);

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
}
