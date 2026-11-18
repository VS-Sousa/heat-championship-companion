import { Track } from '../../../models/domain.models';
import { TracksRepository } from '../../data-provider';
import { newId, PreviewStore } from './preview-store';

export class PreviewTracksRepo implements TracksRepository {
  constructor(private readonly store: PreviewStore) {}

  async list(): Promise<Track[]> {
    return [...this.store.snapshot().tracks].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  async getById(id: string): Promise<Track | null> {
    return this.store.snapshot().tracks.find((t) => t.id === id) ?? null;
  }

  async create(input: Omit<Track, 'id'>): Promise<Track> {
    const track: Track = {
      id: newId(),
      name: input.name,
      country: input.country,
    };
    this.store.update((draft) => {
      draft.tracks.push(track);
    });
    return track;
  }

  async update(id: string, input: Omit<Track, 'id'>): Promise<Track> {
    let updated: Track | null = null;
    this.store.update((draft) => {
      const idx = draft.tracks.findIndex((t) => t.id === id);
      if (idx < 0) throw new Error('Track not found.');
      updated = { id, name: input.name, country: input.country };
      draft.tracks[idx] = updated;
    });
    return updated!;
  }

  async remove(id: string): Promise<void> {
    this.store.update((draft) => {
      draft.tracks = draft.tracks.filter((t) => t.id !== id);
    });
  }
}
