import { Driver } from '../../../models/domain.models';
import { mapDriver } from '../../../services/mappers';
import { SupabaseService } from '../../../services/supabase.service';
import { DriversRepository } from '../../data-provider';

export class SupabaseDriversRepo implements DriversRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async list(): Promise<Driver[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('drivers')
      .select('*')
      .order('name');
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapDriver(row as Record<string, unknown>));
  }

  async getById(id: string): Promise<Driver | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('drivers')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapDriver(data as Record<string, unknown>) : null;
  }

  async create(input: Omit<Driver, 'id'>): Promise<Driver> {
    const { data, error } = await this.supabase
      .getClient()
      .from('drivers')
      .insert(this.toRow(input))
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapDriver(data as Record<string, unknown>);
  }

  async update(id: string, input: Omit<Driver, 'id'>): Promise<Driver> {
    const { data, error } = await this.supabase
      .getClient()
      .from('drivers')
      .update(this.toRow(input))
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return mapDriver(data as Record<string, unknown>);
  }

  private toRow(input: Omit<Driver, 'id'>): Record<string, unknown> {
    return {
      name: input.name.trim(),
      nickname: input.nickname?.trim() || null,
      is_legend: input.isLegend,
      fixed_car_id: input.fixedCarId ?? null,
      favorite_car_id: input.favoriteCarId ?? null,
      user_id: input.userId ?? null,
    };
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
