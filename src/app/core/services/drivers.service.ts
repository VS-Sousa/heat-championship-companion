import { inject, Injectable } from '@angular/core';
import { DATA_PROVIDER } from '../data/data-provider.token';
import { Driver } from '../models/domain.models';

@Injectable({ providedIn: 'root' })
export class DriversService {
  private readonly provider = inject(DATA_PROVIDER);

  list(): Promise<Driver[]> {
    return this.provider.drivers.list();
  }

  getById(id: string): Promise<Driver | null> {
    return this.provider.drivers.getById(id);
  }

  create(input: Omit<Driver, 'id'>): Promise<Driver> {
    return this.provider.drivers.create(input);
  }

  update(id: string, input: Omit<Driver, 'id'>): Promise<Driver> {
    return this.provider.drivers.update(id, input);
  }

  remove(id: string): Promise<void> {
    return this.provider.drivers.remove(id);
  }
}
