import { inject, Injectable } from '@angular/core';
import { DATA_PROVIDER } from '../data/data-provider.token';
import { ScoringSystem } from '../models/domain.models';
type Input = Omit<ScoringSystem, 'id' | 'isBuiltin'>;
@Injectable({ providedIn: 'root' })
export class ScoringSystemsService {
  private readonly repo = inject(DATA_PROVIDER).scoringSystems;
  list(): Promise<ScoringSystem[]> { return this.repo.list(); }
  getById(id: string): Promise<ScoringSystem | null> { return this.repo.getById(id); }
  create(input: Input): Promise<ScoringSystem> { return this.repo.create(input); }
  update(id: string, input: Input): Promise<ScoringSystem> { return this.repo.update(id, input); }
  remove(id: string): Promise<void> { return this.repo.remove(id); }
}
