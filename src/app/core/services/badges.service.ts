import { inject, Injectable } from '@angular/core';
import { DATA_PROVIDER } from '../data/data-provider.token';
import { BadgeAward, BadgeDefinition } from '../models/domain.models';
@Injectable({ providedIn: 'root' })
export class BadgesService {
  private readonly repo = inject(DATA_PROVIDER).badges;
  listDefinitions(): Promise<BadgeDefinition[]> { return this.repo.listDefinitions(); }
  listAwards(filters?: { driverId?: string; raceId?: string; associationId?: string }): Promise<BadgeAward[]> { return this.repo.listAwards(filters); }
}
