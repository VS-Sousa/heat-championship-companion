import { BadgeAward, BadgeDefinition } from '../../../models/domain.models';
import { mapBadgeAward, mapBadgeDefinition } from '../../../services/mappers';
import { SupabaseService } from '../../../services/supabase.service';
import { BadgesRepository } from '../../data-provider';

export class SupabaseBadgesRepo implements BadgesRepository {
  constructor(private readonly supabase: SupabaseService) {}
  async listDefinitions(): Promise<BadgeDefinition[]> {
    const { data, error } = await this.supabase.getClient().from('badge_definitions').select('*').order('name');
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapBadgeDefinition(row as Record<string, unknown>));
  }
  async listAwards(filters: { driverId?: string; raceId?: string; associationId?: string } = {}): Promise<BadgeAward[]> {
    let query = this.supabase.getClient().from('badge_awards').select('*');
    if (filters.driverId) query = query.eq('driver_id', filters.driverId);
    if (filters.raceId) query = query.eq('race_id', filters.raceId);
    if (filters.associationId) query = query.eq('association_id', filters.associationId);
    const { data, error } = await query.order('awarded_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapBadgeAward(row as Record<string, unknown>));
  }
}
