import { Injectable } from '@angular/core';
import { Driver, StandingRow } from '../models/domain.models';

export type GridEngine = 'random' | 'reverse_standings';

export interface GridAssignment {
  driverId: string;
  gridPosition: number;
}

@Injectable({ providedIn: 'root' })
export class GridService {
  assign(
    engine: GridEngine,
    drivers: Driver[],
    standings: StandingRow[] = []
  ): GridAssignment[] {
    if (!drivers.length) return [];

    if (engine === 'reverse_standings' && standings.length > 0) {
      return this.reverseStandings(drivers, standings);
    }
    return this.random(drivers);
  }

  random(drivers: Driver[]): GridAssignment[] {
    const shuffled = [...drivers];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.map((d, index) => ({
      driverId: d.id,
      gridPosition: index + 1,
    }));
  }

  /**
   * Championship leader starts last; last place gets pole.
   * Drivers without standings are shuffled into the front (best grid).
   */
  reverseStandings(
    drivers: Driver[],
    standings: StandingRow[]
  ): GridAssignment[] {
    const orderIndex = new Map(
      standings.map((row, index) => [row.driverId, index])
    );

    const ranked = [...drivers].sort((a, b) => {
      const ai = orderIndex.has(a.id) ? orderIndex.get(a.id)! : -1;
      const bi = orderIndex.has(b.id) ? orderIndex.get(b.id)! : -1;
      if (ai === -1 && bi === -1) return Math.random() - 0.5;
      if (ai === -1) return -1;
      if (bi === -1) return 1;
      // Higher standing index (worse) → better grid (lower position number)
      return bi - ai;
    });

    return ranked.map((d, index) => ({
      driverId: d.id,
      gridPosition: index + 1,
    }));
  }
}
