import { Injectable } from '@angular/core';
import { Driver } from '../models/domain.models';
import { mapDriver } from './mappers';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class DriversService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(): Promise<Driver[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('drivers')
      .select('*')
      .order('number');
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapDriver(row as Record<string, unknown>));
  }

  async create(input: Omit<Driver, 'id'>): Promise<Driver> {
    const { data, error } = await this.supabase
      .getClient()
      .from('drivers')
      .insert({
        name: input.name,
        abbreviation: input.abbreviation.toUpperCase(),
        number: input.number,
        is_legend: input.isLegend,
        fixed_car_id: input.fixedCarId ?? null,
        user_id: input.userId ?? null,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapDriver(data as Record<string, unknown>);
  }

  async update(id: string, input: Omit<Driver, 'id'>): Promise<Driver> {
    const { data, error } = await this.supabase
      .getClient()
      .from('drivers')
      .update({
        name: input.name,
        abbreviation: input.abbreviation.toUpperCase(),
        number: input.number,
        is_legend: input.isLegend,
        fixed_car_id: input.fixedCarId ?? null,
        user_id: input.userId ?? null,
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapDriver(data as Record<string, unknown>);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('drivers')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  }
}
