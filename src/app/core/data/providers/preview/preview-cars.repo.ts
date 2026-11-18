import { Car } from '../../../models/domain.models';
import { CarsRepository } from '../../data-provider';
import { normalizeHex } from '../../shared/normalize-hex';
import { newId, PreviewStore } from './preview-store';

export class PreviewCarsRepo implements CarsRepository {
  constructor(private readonly store: PreviewStore) {}

  async list(): Promise<Car[]> {
    return [...this.store.snapshot().cars].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  async getById(id: string): Promise<Car | null> {
    return this.store.snapshot().cars.find((c) => c.id === id) ?? null;
  }

  async create(input: Omit<Car, 'id'>): Promise<Car> {
    const colorHex = normalizeHex(input.colorHex);
    const db = this.store.snapshot();
    if (
      db.cars.some((c) => c.colorHex.toLowerCase() === colorHex.toLowerCase())
    ) {
      throw new Error('That color is already used by another car.');
    }
    const car: Car = {
      id: newId(),
      name: input.name,
      colorHex,
      colorKey: colorHex.toLowerCase(),
    };
    this.store.update((draft) => {
      draft.cars.push(car);
    });
    return car;
  }

  async update(id: string, input: Omit<Car, 'id'>): Promise<Car> {
    const colorHex = normalizeHex(input.colorHex);
    const db = this.store.snapshot();
    if (
      db.cars.some(
        (c) =>
          c.id !== id && c.colorHex.toLowerCase() === colorHex.toLowerCase()
      )
    ) {
      throw new Error('That color is already used by another car.');
    }
    let updated: Car | null = null;
    this.store.update((draft) => {
      const idx = draft.cars.findIndex((c) => c.id === id);
      if (idx < 0) throw new Error('Car not found.');
      updated = {
        id,
        name: input.name,
        colorHex,
        colorKey: colorHex.toLowerCase(),
      };
      draft.cars[idx] = updated;
    });
    return updated!;
  }

  async remove(id: string): Promise<void> {
    this.store.update((draft) => {
      draft.cars = draft.cars.filter((c) => c.id !== id);
    });
  }
}
