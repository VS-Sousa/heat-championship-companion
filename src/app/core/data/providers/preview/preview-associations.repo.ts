import { Association } from '../../../models/domain.models';
import { AssociationsRepository } from '../../data-provider';
import { newId, PreviewStore } from './preview-store';

export class PreviewAssociationsRepo implements AssociationsRepository {
  constructor(private readonly store: PreviewStore) {}
  async list(): Promise<Association[]> { return [...this.store.snapshot().associations].sort((a, b) => a.name.localeCompare(b.name)); }
  async getById(id: string): Promise<Association | null> { return this.store.snapshot().associations.find((x) => x.id === id) ?? null; }
  async create(input: Omit<Association, 'id'>): Promise<Association> {
    const value = { id: newId(), ...input }; this.store.update((db) => db.associations.push(value)); return value;
  }
  async update(id: string, input: Omit<Association, 'id'>): Promise<Association> {
    const value = { id, ...input }; this.store.update((db) => { const i = db.associations.findIndex((x) => x.id === id); if (i < 0) throw new Error('Association not found.'); db.associations[i] = value; }); return value;
  }
  async remove(id: string): Promise<void> { this.store.update((db) => { db.associations = db.associations.filter((x) => x.id !== id); db.associationMembers = db.associationMembers.filter((x) => x.associationId !== id); }); }
  async listMemberIds(associationId: string): Promise<string[]> { return this.store.snapshot().associationMembers.filter((x) => x.associationId === associationId).map((x) => x.driverId); }
  async setMembers(associationId: string, driverIds: string[]): Promise<void> {
    this.store.update((db) => {
      const legendIds = new Set(db.drivers.filter((d) => d.isLegend).map((d) => d.id));
      const allowed = [...new Set(driverIds)].filter((id) => !legendIds.has(id));
      db.associationMembers = db.associationMembers.filter((x) => x.associationId !== associationId);
      db.associationMembers.push(...allowed.map((driverId) => ({ associationId, driverId })));
    });
  }
}
