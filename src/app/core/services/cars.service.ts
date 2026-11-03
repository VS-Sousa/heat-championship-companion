import { Injectable } from '@angular/core';
import { Car } from '../models/domain.models';
import { mapCar } from './mappers';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class CarsService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(): Promise<Car[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('cars')
      .select('*')
      .order('name');
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapCar(row as Record<string, unknown>));
  }

  async create(input: Omit<Car, 'id'>): Promise<Car> {
    const { data, error } = await this.supabase
      .getClient()
      .from('cars')
      .insert({ name: input.name, color_hex: input.colorHex })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapCar(data as Record<string, unknown>);
  }

  async update(id: string, input: Omit<Car, 'id'>): Promise<Car> {
    const { data, error } = await this.supabase
      .getClient()
      .from('cars')
      .update({ name: input.name, color_hex: input.colorHex })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapCar(data as Record<string, unknown>);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.supabase
      .getClient()
      .from('cars')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  }
}
