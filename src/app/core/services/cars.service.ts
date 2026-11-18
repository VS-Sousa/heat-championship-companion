import { inject, Injectable } from '@angular/core';
import { DATA_PROVIDER } from '../data/data-provider.token';
import { Car } from '../models/domain.models';

@Injectable({ providedIn: 'root' })
export class CarsService {
  private readonly provider = inject(DATA_PROVIDER);

  list(): Promise<Car[]> {
    return this.provider.cars.list();
  }

  getById(id: string): Promise<Car | null> {
    return this.provider.cars.getById(id);
  }

  create(input: Omit<Car, 'id'>): Promise<Car> {
    return this.provider.cars.create(input);
  }

  update(id: string, input: Omit<Car, 'id'>): Promise<Car> {
    return this.provider.cars.update(id, input);
  }

  remove(id: string): Promise<void> {
    return this.provider.cars.remove(id);
  }
}
