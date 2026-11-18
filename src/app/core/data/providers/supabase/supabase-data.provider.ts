import { DataProvider } from '../../data-provider';
import { StorageMode } from '../../storage-mode';
import { SupabaseService } from '../../../services/supabase.service';
import { SupabaseCarsRepo } from './supabase-cars.repo';
import { SupabaseDriversRepo } from './supabase-drivers.repo';
import { SupabaseTracksRepo } from './supabase-tracks.repo';
import { SupabaseChampionshipsRepo } from './supabase-championships.repo';
import { SupabaseRacesRepo } from './supabase-races.repo';

export class SupabaseDataProvider implements DataProvider {
  readonly mode: StorageMode = 'supabase';
  readonly cars: SupabaseCarsRepo;
  readonly drivers: SupabaseDriversRepo;
  readonly tracks: SupabaseTracksRepo;
  readonly championships: SupabaseChampionshipsRepo;
  readonly races: SupabaseRacesRepo;

  constructor(supabase: SupabaseService) {
    this.cars = new SupabaseCarsRepo(supabase);
    this.drivers = new SupabaseDriversRepo(supabase);
    this.tracks = new SupabaseTracksRepo(supabase);
    this.championships = new SupabaseChampionshipsRepo(supabase, this);
    this.races = new SupabaseRacesRepo(supabase, this);
  }
}
