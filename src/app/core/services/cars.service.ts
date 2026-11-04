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

  async getById(id: string): Promise<Car | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('cars')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapCar(data as Record<string, unknown>) : null;
  }

  async create(input: Omit<Car, 'id'>): Promise<Car> {
    const colorHex = this.normalizeHex(input.colorHex);
    const { data, error } = await this.supabase
      .getClient()
      .from('cars')
      .insert({
        name: input.name,
        color_hex: colorHex,
        color_key: colorHex.toLowerCase(),
      })
      .select('*')
      .single();
    if (error) {
      if (error.message.toLowerCase().includes('unique')) {
        throw new Error('That color is already used by another car.');
      }
      throw new Error(error.message);
    }
    return mapCar(data as Record<string, unknown>);
  }

  async update(id: string, input: Omit<Car, 'id'>): Promise<Car> {
    const colorHex = this.normalizeHex(input.colorHex);
    const { data, error } = await this.supabase
      .getClient()
      .from('cars')
      .update({
        name: input.name,
        color_hex: colorHex,
        color_key: colorHex.toLowerCase(),
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error) {
      if (error.message.toLowerCase().includes('unique')) {
        throw new Error('That color is already used by another car.');
      }
      throw new Error(error.message);
    }
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

  private normalizeHex(hex: string): string {
    const value = hex.trim();
    if (!/^#?[0-9a-fA-F]{6}$/.test(value)) {
      throw new Error('Invalid color. Use a hex value like #E1221C.');
    }
    return value.startsWith('#') ? value.toUpperCase() : `#${value.toUpperCase()}`;
  }
}
