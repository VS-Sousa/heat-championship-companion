import { GarageUpgrade } from '../../../models/domain.models';
import { mapGarageUpgrade } from '../../../services/mappers';
import { SupabaseService } from '../../../services/supabase.service';
import { GarageUpgradesRepository } from '../../data-provider';

export class SupabaseGarageUpgradesRepo implements GarageUpgradesRepository {
  constructor(private readonly supabase: SupabaseService) {}
  async list(): Promise<GarageUpgrade[]> {
    const { data, error } = await this.supabase.getClient().from('garage_upgrades').select('*').order('heat_cost').order('name');
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapGarageUpgrade(row as Record<string, unknown>));
  }
  async getById(id: string): Promise<GarageUpgrade | null> {
    const { data, error } = await this.supabase.getClient().from('garage_upgrades').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapGarageUpgrade(data as Record<string, unknown>) : null;
  }
  create(input: Omit<GarageUpgrade, 'id'>): Promise<GarageUpgrade> { return this.write(undefined, input); }
  update(id: string, input: Omit<GarageUpgrade, 'id'>): Promise<GarageUpgrade> { return this.write(id, input); }
  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.getClient().from('garage_upgrades').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
  private async write(id: string | undefined, input: Omit<GarageUpgrade, 'id'>): Promise<GarageUpgrade> {
    const row = { name: input.name, category: input.category, heat_cost: input.heatCost, effect: input.effect };
    const table = this.supabase.getClient().from('garage_upgrades');
    const query = id ? table.update(row).eq('id', id) : table.insert(row);
    const { data, error } = await query.select('*').single();
    if (error) throw new Error(error.message);
    return mapGarageUpgrade(data as Record<string, unknown>);
  }
}
