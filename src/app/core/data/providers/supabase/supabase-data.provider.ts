import { DataProvider } from '../../data-provider';
import { StorageMode } from '../../storage-mode';
import { SupabaseService } from '../../../services/supabase.service';
import { SupabaseCarsRepo } from './supabase-cars.repo';
import { SupabaseDriversRepo } from './supabase-drivers.repo';
import { SupabaseTracksRepo } from './supabase-tracks.repo';
import { SupabaseChampionshipsRepo } from './supabase-championships.repo';
import { SupabaseRacesRepo } from './supabase-races.repo';
import { SupabaseAssociationsRepo } from './supabase-associations.repo';
import { SupabaseBadgesRepo } from './supabase-badges.repo';
import { SupabaseGarageUpgradesRepo } from './supabase-garage-upgrades.repo';
import { SupabaseScoringSystemsRepo } from './supabase-scoring-systems.repo';

export class SupabaseDataProvider implements DataProvider {
  readonly mode: StorageMode = 'supabase';
  readonly cars: SupabaseCarsRepo;
  readonly drivers: SupabaseDriversRepo;
  readonly tracks: SupabaseTracksRepo;
  readonly associations: SupabaseAssociationsRepo;
  readonly scoringSystems: SupabaseScoringSystemsRepo;
  readonly garageUpgrades: SupabaseGarageUpgradesRepo;
  readonly badges: SupabaseBadgesRepo;
  readonly championships: SupabaseChampionshipsRepo;
  readonly races: SupabaseRacesRepo;

  constructor(supabase: SupabaseService) {
    this.cars = new SupabaseCarsRepo(supabase);
    this.drivers = new SupabaseDriversRepo(supabase);
    this.tracks = new SupabaseTracksRepo(supabase);
    this.associations = new SupabaseAssociationsRepo(supabase);
    this.scoringSystems = new SupabaseScoringSystemsRepo(supabase);
    this.garageUpgrades = new SupabaseGarageUpgradesRepo(supabase);
    this.badges = new SupabaseBadgesRepo(supabase);
    this.championships = new SupabaseChampionshipsRepo(supabase, this);
    this.races = new SupabaseRacesRepo(supabase, this);
  }
}
