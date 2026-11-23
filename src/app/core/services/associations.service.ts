import { inject, Injectable } from '@angular/core';
import { DATA_PROVIDER } from '../data/data-provider.token';
import { Association } from '../models/domain.models';
@Injectable({ providedIn: 'root' })
export class AssociationsService {
  private readonly repo = inject(DATA_PROVIDER).associations;
  list(): Promise<Association[]> { return this.repo.list(); }
  getById(id: string): Promise<Association | null> { return this.repo.getById(id); }
  create(input: Omit<Association, 'id'>): Promise<Association> { return this.repo.create(input); }
  update(id: string, input: Omit<Association, 'id'>): Promise<Association> { return this.repo.update(id, input); }
  remove(id: string): Promise<void> { return this.repo.remove(id); }
  listMemberIds(id: string): Promise<string[]> { return this.repo.listMemberIds(id); }
  setMembers(id: string, driverIds: string[]): Promise<void> { return this.repo.setMembers(id, driverIds); }
}
