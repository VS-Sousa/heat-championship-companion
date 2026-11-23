import { ScoringSystem } from '../../../models/domain.models';
import { ScoringSystemsRepository } from '../../data-provider';
import { newId, PreviewStore } from './preview-store';
type Input = Omit<ScoringSystem, 'id' | 'isBuiltin'>;
export class PreviewScoringSystemsRepo implements ScoringSystemsRepository {
  constructor(private readonly store: PreviewStore) {}
  async list(): Promise<ScoringSystem[]> { return [...this.store.snapshot().scoringSystems]; }
  async getById(id: string): Promise<ScoringSystem | null> { return this.store.snapshot().scoringSystems.find((x) => x.id === id) ?? null; }
  async create(input: Input): Promise<ScoringSystem> { const value = { id: newId(), ...input, isBuiltin: false }; this.store.update((db) => db.scoringSystems.push(value)); return value; }
  async update(id: string, input: Input): Promise<ScoringSystem> { const value = { id, ...input, isBuiltin: false }; this.store.update((db) => { const i = db.scoringSystems.findIndex((x) => x.id === id && !x.isBuiltin); if (i < 0) throw new Error('Editable scoring system not found.'); db.scoringSystems[i] = value; }); return value; }
  async remove(id: string): Promise<void> { this.store.update((db) => { db.scoringSystems = db.scoringSystems.filter((x) => x.id !== id || x.isBuiltin); }); }
}
