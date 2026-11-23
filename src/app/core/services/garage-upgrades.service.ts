import { inject, Injectable } from '@angular/core';
import { DATA_PROVIDER } from '../data/data-provider.token';
import { GarageUpgrade } from '../models/domain.models';
@Injectable({ providedIn: 'root' })
export class GarageUpgradesService {
  private readonly repo = inject(DATA_PROVIDER).garageUpgrades;
  list(): Promise<GarageUpgrade[]> { return this.repo.list(); }
  getById(id: string): Promise<GarageUpgrade | null> { return this.repo.getById(id); }
  create(input: Omit<GarageUpgrade, 'id'>): Promise<GarageUpgrade> { return this.repo.create(input); }
  update(id: string, input: Omit<GarageUpgrade, 'id'>): Promise<GarageUpgrade> { return this.repo.update(id, input); }
  remove(id: string): Promise<void> { return this.repo.remove(id); }
}
