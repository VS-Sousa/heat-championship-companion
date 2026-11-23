import { ScoringSystem } from '../../../models/domain.models';
import { mapScoringSystem } from '../../../services/mappers';
import { SupabaseService } from '../../../services/supabase.service';
import { ScoringSystemsRepository } from '../../data-provider';

type Input = Omit<ScoringSystem, 'id' | 'isBuiltin'>;
export class SupabaseScoringSystemsRepo implements ScoringSystemsRepository {
  constructor(private readonly supabase: SupabaseService) {}
  async list(): Promise<ScoringSystem[]> {
    const { data, error } = await this.supabase.getClient().from('scoring_systems').select('*').order('name');
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => mapScoringSystem(row as Record<string, unknown>));
  }
  async getById(id: string): Promise<ScoringSystem | null> {
    const { data, error } = await this.supabase.getClient().from('scoring_systems').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapScoringSystem(data as Record<string, unknown>) : null;
  }
  create(input: Input): Promise<ScoringSystem> { return this.write(undefined, input); }
  update(id: string, input: Input): Promise<ScoringSystem> { return this.write(id, input); }
  async remove(id: string): Promise<void> {
    const { error } = await this.supabase.getClient().from('scoring_systems').delete().eq('id', id).eq('is_builtin', false);
    if (error) throw new Error(error.message);
  }
  private async write(id: string | undefined, input: Input): Promise<ScoringSystem> {
    const row = { name: input.name, points: input.points, bonus_fastest_lap: input.bonusFastestLap, bonus_pole: input.bonusPole, bonus_driver_of_the_day: input.bonusDriverOfDay };
    const table = this.supabase.getClient().from('scoring_systems');
    const query = id ? table.update(row).eq('id', id).eq('is_builtin', false) : table.insert({ ...row, is_builtin: false });
    const { data, error } = await query.select('*').single();
    if (error) throw new Error(error.message);
    return mapScoringSystem(data as Record<string, unknown>);
  }
}
