import { inject, Injectable } from '@angular/core';
import { DATA_PROVIDER } from '../data/data-provider.token';
import { Track } from '../models/domain.models';

@Injectable({ providedIn: 'root' })
export class TracksService {
  private readonly provider = inject(DATA_PROVIDER);

  list(): Promise<Track[]> {
    return this.provider.tracks.list();
  }

  getById(id: string): Promise<Track | null> {
    return this.provider.tracks.getById(id);
  }

  create(input: Omit<Track, 'id'>): Promise<Track> {
    return this.provider.tracks.create(input);
  }

  update(id: string, input: Omit<Track, 'id'>): Promise<Track> {
    return this.provider.tracks.update(id, input);
  }

  remove(id: string): Promise<void> {
    return this.provider.tracks.remove(id);
  }
}
