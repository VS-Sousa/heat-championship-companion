import { DataProvider } from '../../data-provider';
import { PreviewCarsRepo } from './preview-cars.repo';
import { PreviewChampionshipsRepo } from './preview-championships.repo';
import { PreviewDriversRepo } from './preview-drivers.repo';
import { PreviewRacesRepo } from './preview-races.repo';
import { PreviewStore } from './preview-store';
import { PreviewTracksRepo } from './preview-tracks.repo';
import { PreviewAssociationsRepo } from './preview-associations.repo';
import { PreviewBadgesRepo } from './preview-badges.repo';
import { PreviewGarageUpgradesRepo } from './preview-garage-upgrades.repo';
import { PreviewScoringSystemsRepo } from './preview-scoring-systems.repo';

export class PreviewDataProvider implements DataProvider {
  readonly mode = 'preview' as const;
  private readonly store = new PreviewStore();
  readonly cars: PreviewCarsRepo;
  readonly drivers: PreviewDriversRepo;
  readonly tracks: PreviewTracksRepo;
  readonly associations: PreviewAssociationsRepo;
  readonly scoringSystems: PreviewScoringSystemsRepo;
  readonly garageUpgrades: PreviewGarageUpgradesRepo;
  readonly badges: PreviewBadgesRepo;
  readonly championships: PreviewChampionshipsRepo;
  readonly races: PreviewRacesRepo;

  constructor() {
    this.cars = new PreviewCarsRepo(this.store);
    this.drivers = new PreviewDriversRepo(this.store);
    this.tracks = new PreviewTracksRepo(this.store);
    this.associations = new PreviewAssociationsRepo(this.store);
    this.scoringSystems = new PreviewScoringSystemsRepo(this.store);
    this.garageUpgrades = new PreviewGarageUpgradesRepo(this.store);
    this.badges = new PreviewBadgesRepo(this.store);
    this.championships = new PreviewChampionshipsRepo(this.store, this);
    this.races = new PreviewRacesRepo(this.store, this);
  }

  resetPreview(): void {
    this.store.reset();
  }
}
