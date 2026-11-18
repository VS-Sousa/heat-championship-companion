import {
  Car,
  Championship,
  Driver,
  Race,
  RaceResult,
  Track,
} from '../../../models/domain.models';
import { createPreviewSeed } from './preview-seed';

export const PREVIEW_DB_KEY = 'heat_preview_db';

export interface PreviewDb {
  cars: Car[];
  drivers: Driver[];
  tracks: Track[];
  championships: Championship[];
  races: Race[];
  results: RaceResult[];
}

export class PreviewStore {
  private db: PreviewDb;

  constructor() {
    this.db = this.load() ?? createPreviewSeed();
    this.persist();
  }

  snapshot(): PreviewDb {
    return this.db;
  }

  reset(): void {
    this.db = createPreviewSeed();
    this.persist();
  }

  /** Replace entire collections (repos mutate then call save). */
  save(next: PreviewDb): void {
    this.db = next;
    this.persist();
  }

  update(mutator: (db: PreviewDb) => void): void {
    mutator(this.db);
    this.persist();
  }

  private load(): PreviewDb | null {
    try {
      const raw = localStorage.getItem(PREVIEW_DB_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PreviewDb;
      if (
        !parsed?.cars ||
        !parsed?.drivers ||
        !parsed?.tracks ||
        !parsed?.championships ||
        !parsed?.races ||
        !parsed?.results
      ) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(PREVIEW_DB_KEY, JSON.stringify(this.db));
    } catch {
      /* ignore quota */
    }
  }
}

export function newId(): string {
  return crypto.randomUUID();
}
