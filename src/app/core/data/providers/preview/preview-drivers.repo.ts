import { Driver } from '../../../models/domain.models';
import { DriversRepository } from '../../data-provider';
import { newId, PreviewStore } from './preview-store';

export class PreviewDriversRepo implements DriversRepository {
  constructor(private readonly store: PreviewStore) {}

  async list(): Promise<Driver[]> {
    return [...this.store.snapshot().drivers].sort(
      (a, b) => a.number - b.number
    );
  }

  async getById(id: string): Promise<Driver | null> {
    return this.store.snapshot().drivers.find((d) => d.id === id) ?? null;
  }

  async create(input: Omit<Driver, 'id'>): Promise<Driver> {
    const driver: Driver = {
      id: newId(),
      name: input.name,
      nickname: input.nickname?.trim() || undefined,
      abbreviation: input.abbreviation.toUpperCase(),
      number: input.number,
      isLegend: input.isLegend,
      fixedCarId: input.fixedCarId,
      favoriteCarId: input.favoriteCarId,
      userId: input.userId,
    };
    this.store.update((draft) => {
      draft.drivers.push(driver);
    });
    return driver;
  }

  async update(id: string, input: Omit<Driver, 'id'>): Promise<Driver> {
    let updated: Driver | null = null;
    this.store.update((draft) => {
      const idx = draft.drivers.findIndex((d) => d.id === id);
      if (idx < 0) throw new Error('Driver not found.');
      updated = {
        id,
        name: input.name,
        nickname: input.nickname?.trim() || undefined,
        abbreviation: input.abbreviation.toUpperCase(),
        number: input.number,
        isLegend: input.isLegend,
        fixedCarId: input.fixedCarId,
        favoriteCarId: input.favoriteCarId,
        userId: input.userId,
      };
      draft.drivers[idx] = updated;
    });
    return updated!;
  }

  async remove(id: string): Promise<void> {
    this.store.update((draft) => {
      draft.drivers = draft.drivers.filter((d) => d.id !== id);
    });
  }
}
