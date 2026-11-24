import { Association } from '../../../models/domain.models';
import { mapAssociation } from '../../../services/mappers';
import { SupabaseService } from '../../../services/supabase.service';
import { AssociationsRepository } from '../../data-provider';

export class SupabaseAssociationsRepo implements AssociationsRepository {
  constructor(private readonly supabase: SupabaseService) {}
  async list(): Promise<Association[]> {
    const { data, error } = await this.supabase.getClient().from('associations').select('*').order('name');
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapAssociation(row as Record<string, unknown>));
  }
  async getById(id: string): Promise<Association | null> {
    const { data, error } = await this.supabase.getClient().from('associations').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapAssociation(data as Record<string, unknown>) : null;
  }
  async create(input: Omit<Association, 'id'>): Promise<Association> { return this.write('insert', undefined, input); }
  async update(id: string, input: Omit<Association, 'id'>): Promise<Association> { return this.write('update', id, input); }
  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.getClient().from('associations').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
  async listMemberIds(associationId: string): Promise<string[]> {
    const { data, error } = await this.supabase.getClient().from('association_members').select('driver_id').eq('association_id', associationId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => String(row.driver_id));
  }
  async setMembers(associationId: string, driverIds: string[]): Promise<void> {
    const client = this.supabase.getClient();
    const uniqueIds = [...new Set(driverIds)];

    // Legends cannot be association members (also enforced by a DB trigger).
    let eligibleIds: string[] = [];
    if (uniqueIds.length) {
      const { data, error } = await client
        .from('drivers')
        .select('id')
        .in('id', uniqueIds)
        .eq('is_legend', false);
      if (error) throw new Error(error.message);
      eligibleIds = (data ?? []).map((row) => String((row as { id: string }).id));
    }

    const removed = await client.from('association_members').delete().eq('association_id', associationId);
    if (removed.error) throw new Error(removed.error.message);
    if (eligibleIds.length) {
      const { error } = await client.from('association_members').insert(eligibleIds.map((driverId) => ({ association_id: associationId, driver_id: driverId })));
      if (error) throw new Error(error.message);
    }
  }
  private async write(kind: 'insert' | 'update', id: string | undefined, input: Omit<Association, 'id'>): Promise<Association> {
    const table = this.supabase.getClient().from('associations');
    const row = { name: input.name.trim() };
    if (!row.name) throw new Error('Association name is required.');
    const query = kind === 'insert' ? table.insert(row) : table.update(row).eq('id', id!);
    const { data, error } = await query.select('*').single();
    if (error) throw new Error(error.message);
    return mapAssociation(data as Record<string, unknown>);
  }
}
