import { SupabaseService } from '../../../services/supabase.service';

/** Number/abbreviation are championship-scoped; this is a display fallback for cross-championship views. */
export interface DriverIdentity {
  abbreviation: string;
  number: number;
}

export function fallbackDriverIdentity(name: string): DriverIdentity {
  const letters = name.replace(/[^\p{L}]/gu, '').toUpperCase();
  return {
    abbreviation: (letters.slice(0, 3) || '???').padEnd(3, '?'),
    number: 0,
  };
}

/**
 * Most recent championship entry identity per driver (by created_at).
 * Used for stats/overall rows that are not scoped to one championship.
 */
export async function loadLatestDriverIdentities(
  supabase: SupabaseService
): Promise<Map<string, DriverIdentity>> {
  const { data, error } = await supabase
    .getClient()
    .from('championship_entries')
    .select('driver_id, number, abbreviation, created_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const map = new Map<string, DriverIdentity>();
  for (const row of data ?? []) {
    const record = row as Record<string, unknown>;
    const driverId = String(record['driver_id']);
    if (map.has(driverId)) continue;
    map.set(driverId, {
      abbreviation: String(record['abbreviation']),
      number: Number(record['number']),
    });
  }
  return map;
}
