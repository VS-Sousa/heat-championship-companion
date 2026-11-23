import { BadgeAward, BadgeDefinition } from '../../../models/domain.models';
import { BadgesRepository } from '../../data-provider';
import { PreviewStore } from './preview-store';
export class PreviewBadgesRepo implements BadgesRepository {
  constructor(private readonly store: PreviewStore) {}
  async listDefinitions(): Promise<BadgeDefinition[]> { return [...this.store.snapshot().badgeDefinitions]; }
  async listAwards(filters: { driverId?: string; raceId?: string; associationId?: string } = {}): Promise<BadgeAward[]> {
    return this.store.snapshot().badgeAwards.filter((x) =>
      (!filters.driverId || x.driverId === filters.driverId) &&
      (!filters.raceId || x.raceId === filters.raceId) &&
      (!filters.associationId || x.associationId === filters.associationId));
  }
}
