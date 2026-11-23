import { GarageUpgrade } from '../../../models/domain.models';
import { GarageUpgradesRepository } from '../../data-provider';
import { newId, PreviewStore } from './preview-store';
export class PreviewGarageUpgradesRepo implements GarageUpgradesRepository {
  constructor(private readonly store: PreviewStore) {}
  async list(): Promise<GarageUpgrade[]> { return [...this.store.snapshot().garageUpgrades]; }
  async getById(id: string): Promise<GarageUpgrade | null> { return this.store.snapshot().garageUpgrades.find((x) => x.id === id) ?? null; }
  async create(input: Omit<GarageUpgrade, 'id'>): Promise<GarageUpgrade> { const value = { id: newId(), ...input }; this.store.update((db) => db.garageUpgrades.push(value)); return value; }
  async update(id: string, input: Omit<GarageUpgrade, 'id'>): Promise<GarageUpgrade> { const value = { id, ...input }; this.store.update((db) => { const i = db.garageUpgrades.findIndex((x) => x.id === id); if (i < 0) throw new Error('Upgrade not found.'); db.garageUpgrades[i] = value; }); return value; }
  async remove(id: string): Promise<void> { this.store.update((db) => { db.garageUpgrades = db.garageUpgrades.filter((x) => x.id !== id); }); }
}
