import {
  BreakdownStatRow,
  CarStatRow,
  CompletePlannedRaceRequest,
  CompletePostRaceRequest,
  DriverStatRow,
  HeadToHeadRow,
  LogStandaloneRaceRequest,
  Race,
  RaceResult,
  SavePreRaceRequest,
  SaveTelemetryRequest,
  ResultHistoryRow,
  TrackDriverHistoryRow,
} from '../../../models/domain.models';
import { formatDriverName } from '../../../utils/driver-display';
import { DataProvider, RacesRepository } from '../../data-provider';
import {
  pointsForPosition as calculatePointsForPosition,
  validateResults as validateRaceResults,
} from '../../shared/race-rules';
import { resolveDriverLabel } from './preview-driver-label';
import { newId, PreviewStore } from './preview-store';
import { evaluateRaceBadges } from '../../shared/badge-evaluator';

export class PreviewRacesRepo implements RacesRepository {
  constructor(
    private readonly store: PreviewStore,
    private readonly provider: DataProvider
  ) {}

  async listRecent(limit = 10): Promise<Race[]> {
    return [...this.store.snapshot().races]
      .sort((a, b) =>
        (b.createdAt ?? b.racedAt ?? '').localeCompare(
          a.createdAt ?? a.racedAt ?? ''
        )
      )
      .slice(0, limit);
  }

  async getRace(id: string): Promise<Race | null> {
    return this.store.snapshot().races.find((race) => race.id === id) ?? null;
  }

  async listResultsByRace(raceId: string): Promise<RaceResult[]> {
    return this.store
      .snapshot()
      .results.filter((result) => result.raceId === raceId)
      .sort((a, b) => a.position - b.position);
  }

  async completePlannedRace(
    request: CompletePlannedRaceRequest
  ): Promise<Race> {
    this.validateResults(request.results);
    let completed: Race | undefined;
    this.store.update((draft) => {
      const index = draft.races.findIndex(
        (race) => race.id === request.raceId && race.status === 'planned'
      );
      if (index < 0) throw new Error('Planned race not found.');
      completed = {
        ...draft.races[index],
        trackId: request.trackId,
        weatherCondition: request.weatherCondition,
        trackCondition: request.trackCondition,
        racedAt: request.racedAt,
        status: 'completed',
      };
      draft.races[index] = completed;
      draft.results.push(...this.resultEntities(completed.id, request.results));
    });
    return completed!;
  }

  async logStandaloneRace(request: LogStandaloneRaceRequest): Promise<Race> {
    this.validateResults(request.results);
    const race: Race = {
      id: newId(),
      trackId: request.trackId,
      raceType: 'standalone',
      status: 'completed',
      weatherCondition: request.weatherCondition,
      trackCondition: request.trackCondition,
      racedAt: request.racedAt,
      createdAt: new Date().toISOString(),
    };
    this.store.update((draft) => {
      draft.races.push(race);
      draft.results.push(...this.resultEntities(race.id, request.results));
    });
    return race;
  }

  async cancelRace(raceId: string): Promise<Race> {
    let cancelled: Race | undefined;
    this.store.update((draft) => {
      const index = draft.races.findIndex((race) => race.id === raceId);
      if (index < 0) throw new Error('Race not found.');
      cancelled = { ...draft.races[index], status: 'cancelled' };
      draft.races[index] = cancelled;
    });
    return cancelled!;
  }

  async savePreRace(request: SavePreRaceRequest): Promise<Race> {
    let saved!: Race;
    this.store.update((db) => {
      const existing = request.raceId ? db.races.find((x) => x.id === request.raceId) : undefined;
      if (request.championshipId) {
        // Championship races must come from a planned calendar slot.
        if (!request.raceId) throw new Error('A planned race is required for championship races.');
        if (!existing || existing.championshipId !== request.championshipId) throw new Error('Planned race not found.');
        if (existing.status !== 'planned' && existing.status !== 'pre_race') throw new Error('Only planned races can be started.');
      }
      saved = {
        ...(existing ?? { id: newId(), raceType: request.championshipId ? 'championship' : 'standalone', status: 'pre_race' as const, createdAt: new Date().toISOString() }),
        championshipId: request.championshipId ?? existing?.championshipId,
        trackId: request.trackId, name: request.name, abbreviation: request.abbreviation,
        associationId: request.associationId, scoringSystemId: request.scoringSystemId,
        reverseDirection: request.reverseDirection, weatherCondition: request.weatherCondition,
        trackCondition: request.trackCondition, racedAt: request.racedAt,
        entries: request.entries, status: 'pre_race', stage: 'pre_race',
      };
      if (existing) db.races[db.races.indexOf(existing)] = saved; else db.races.push(saved);
    });
    return saved;
  }

  async startLive(raceId: string): Promise<Race> { return this.setStage(raceId, 'in_race'); }
  async saveTelemetry(request: SaveTelemetryRequest): Promise<Race> {
    let saved!: Race;
    this.store.update((db) => { const i = db.races.findIndex((x) => x.id === request.raceId); if (i < 0) throw new Error('Race not found.'); saved = { ...db.races[i], telemetry: request.telemetry }; db.races[i] = saved; });
    return saved;
  }
  async openPodium(raceId: string): Promise<Race> { return this.setStage(raceId, 'post_race'); }
  async completePostRace(request: CompletePostRaceRequest): Promise<Race> {
    this.validateResults(request.results);
    let completed!: Race;
    this.store.update((db) => {
      const i = db.races.findIndex((x) => x.id === request.raceId); if (i < 0) throw new Error('Race not found.');
      completed = { ...db.races[i], status: 'completed', stage: 'post_race' }; db.races[i] = completed;
      db.results = db.results.filter((x) => x.raceId !== request.raceId);
      db.results.push(...request.results.map((x) => ({ id: newId(), raceId: request.raceId, ...x })));
      db.badgeAwards = db.badgeAwards.filter((x) => x.raceId !== request.raceId);
      db.badgeAwards.push(...evaluateRaceBadges({ raceId: request.raceId, associationId: completed.associationId, telemetry: completed.telemetry ?? [], results: request.results, newId }));
    });
    return completed;
  }

  private async setStage(raceId: string, stage: 'in_race' | 'post_race'): Promise<Race> {
    let saved!: Race;
    this.store.update((db) => { const i = db.races.findIndex((x) => x.id === raceId); if (i < 0) throw new Error('Race not found.'); saved = { ...db.races[i], status: stage, stage }; db.races[i] = saved; });
    return saved;
  }

  async getDriverStats(): Promise<DriverStatRow[]> {
    const [drivers, results] = await Promise.all([
      this.provider.drivers.list(),
      this.completedResults(),
    ]);
    const entries = this.store.snapshot().championshipEntries;
    return drivers
      .map((driver) => {
        const label = resolveDriverLabel(driver, entries);
        const owned = results.filter((result) => result.driverId === driver.id);
        const finishes = owned;
        return {
          driverId: driver.id,
          driverName: formatDriverName(driver),
          nickname: driver.nickname,
          abbreviation: label.abbreviation,
          number: label.number,
          isLegend: driver.isLegend,
          races: owned.length,
          wins: finishes.filter((result) => result.position === 1).length,
          podiums: finishes.filter((result) => result.position <= 3).length,
          points: owned.reduce(
            (sum, result) => sum + result.pointsAwarded,
            0
          ),
          avgFinish: finishes.length
            ? finishes.reduce((sum, result) => sum + result.position, 0) /
              finishes.length
            : null,
        };
      })
      .sort(
        (a, b) =>
          b.points - a.points || b.wins - a.wins || b.podiums - a.podiums
      );
  }

  async getCarStats(): Promise<CarStatRow[]> {
    const [cars, results] = await Promise.all([
      this.provider.cars.list(),
      this.completedResults(),
    ]);
    return cars
      .map((car) => {
        const owned = results.filter((result) => result.carId === car.id);
        const finishes = owned;
        return {
          carId: car.id,
          carName: car.name,
          colorHex: car.colorHex,
          races: owned.length,
          wins: finishes.filter((result) => result.position === 1).length,
          podiums: finishes.filter((result) => result.position <= 3).length,
        };
      })
      .sort((a, b) => b.wins - a.wins || b.races - a.races);
  }

  async getDriverResultHistory(driverId: string): Promise<ResultHistoryRow[]> {
    return this.buildHistory({ driverId });
  }

  async getCarResultHistory(carId: string): Promise<ResultHistoryRow[]> {
    return this.buildHistory({ carId });
  }

  async getDriverBreakdownByCar(driverId: string): Promise<BreakdownStatRow[]> {
    return this.breakdown(
      await this.getDriverResultHistory(driverId),
      (row) => ({
        id: row.carId,
        label: row.carName,
        colorHex: row.carColorHex,
      })
    );
  }

  async getDriverBreakdownByTrack(
    driverId: string
  ): Promise<BreakdownStatRow[]> {
    return this.breakdown(
      await this.getDriverResultHistory(driverId),
      (row) => ({
        id: row.trackId ?? 'unknown',
        label: row.trackName ?? '—',
      })
    );
  }

  async getCarBreakdownByDriver(carId: string): Promise<BreakdownStatRow[]> {
    return this.breakdown(await this.getCarResultHistory(carId), (row) => ({
      id: row.driverId,
      label: row.driverName,
    }));
  }

  async getCarBreakdownByTrack(carId: string): Promise<BreakdownStatRow[]> {
    return this.breakdown(await this.getCarResultHistory(carId), (row) => ({
      id: row.trackId ?? 'unknown',
      label: row.trackName ?? '—',
    }));
  }

  async getTrackDriverHistory(
    trackId: string
  ): Promise<TrackDriverHistoryRow[]> {
    const history = await this.buildHistory({ trackId });
    const grouped = new Map<
      string,
      TrackDriverHistoryRow & { finishSum: number; finishCount: number }
    >();
    for (const row of history) {
      const current = grouped.get(row.driverId) ?? {
        driverId: row.driverId,
        driverName: row.driverName,
        races: 0,
        wins: 0,
        podiums: 0,
        avgFinish: null,
        bestFinish: null,
        finishSum: 0,
        finishCount: 0,
      };
      current.races += 1;
      if (row.position === 1) current.wins += 1;
      if (row.position <= 3) current.podiums += 1;
      current.finishSum += row.position;
      current.finishCount += 1;
      current.bestFinish =
        current.bestFinish === null
          ? row.position
          : Math.min(current.bestFinish, row.position);
      grouped.set(row.driverId, current);
    }
    return [...grouped.values()]
      .map(({ finishSum, finishCount, ...row }) => ({
        ...row,
        avgFinish: finishCount ? finishSum / finishCount : null,
      }))
      .sort((a, b) => b.wins - a.wins || b.races - a.races);
  }

  async getDriverHeadToHead(driverId: string): Promise<HeadToHeadRow[]> {
    const [results, drivers] = await Promise.all([
      this.completedResults(),
      this.provider.drivers.list(),
    ]);
    const byRace = new Map<string, RaceResult[]>();
    for (const result of results) {
      const list = byRace.get(result.raceId) ?? [];
      list.push(result);
      byRace.set(result.raceId, list);
    }
    const headToHead = new Map<string, HeadToHeadRow>();
    for (const raceResults of byRace.values()) {
      const driverResult = raceResults.find(
        (result) => result.driverId === driverId
      );
      if (!driverResult) continue;
      for (const other of raceResults) {
        if (other.driverId === driverId) continue;
        const opponent = drivers.find((driver) => driver.id === other.driverId);
        if (!opponent) continue;
        const row = headToHead.get(other.driverId) ?? {
          opponentId: other.driverId,
          opponentName: formatDriverName(opponent),
          wins: 0,
          losses: 0,
          draws: 0,
        };
        const driverPosition = driverResult.position;
        const opponentPosition = other.position;
        if (driverPosition < opponentPosition) row.wins += 1;
        else if (driverPosition > opponentPosition) row.losses += 1;
        else row.draws += 1;
        headToHead.set(other.driverId, row);
      }
    }
    return [...headToHead.values()].sort(
      (a, b) => b.wins - a.wins || a.losses - b.losses
    );
  }

  async getDriverBestFinish(
    driverId: string
  ): Promise<{ position: number; racedAt?: string; trackName?: string } | null> {
    const history = (await this.getDriverResultHistory(driverId))
      .sort(
        (a, b) =>
          a.position - b.position ||
          (b.racedAt ?? '').localeCompare(a.racedAt ?? '')
      );
    const best = history[0];
    return best
      ? {
          position: best.position,
          racedAt: best.racedAt,
          trackName: best.trackName,
        }
      : null;
  }

  pointsForPosition(
    pointSystem: number[],
    position: number
  ): number {
    return calculatePointsForPosition(pointSystem, position);
  }

  validateResults(
    results: {
      driverId: string;
      carId: string;
      gridPosition: number;
      position: number;
    }[]
  ): void {
    validateRaceResults(results);
  }

  private resultEntities(
    raceId: string,
    results: CompletePlannedRaceRequest['results']
  ): RaceResult[] {
    return results.map((result) => ({
      id: newId(),
      raceId,
      driverId: result.driverId,
      carId: result.carId,
      gridPosition: result.gridPosition,
      position: result.position,
      pointsAwarded: result.pointsAwarded,
      gapTurns: result.gapTurns,
      driverOfTheDay: result.driverOfTheDay,
      loadout: result.loadout,
    }));
  }

  private async completedResults(): Promise<RaceResult[]> {
    const completedIds = new Set(
      this.store
        .snapshot()
        .races.filter((race) => race.status === 'completed')
        .map((race) => race.id)
    );
    return this.store
      .snapshot()
      .results.filter((result) => completedIds.has(result.raceId));
  }

  private async buildHistory(filter: {
    driverId?: string;
    carId?: string;
    trackId?: string;
  }): Promise<ResultHistoryRow[]> {
    const db = this.store.snapshot();
    const [drivers, cars, tracks] = await Promise.all([
      this.provider.drivers.list(),
      this.provider.cars.list(),
      this.provider.tracks.list(),
    ]);
    const completedRaces = new Map(
      db.races
        .filter(
          (race) =>
            race.status === 'completed' &&
            (!filter.trackId || race.trackId === filter.trackId)
        )
        .map((race) => [race.id, race])
    );
    const championshipNames = new Map(
      db.championships.map((championship) => [
        championship.id,
        championship.name,
      ])
    );
    const history: ResultHistoryRow[] = [];
    for (const result of db.results) {
      if (filter.driverId && result.driverId !== filter.driverId) continue;
      if (filter.carId && result.carId !== filter.carId) continue;
      const race = completedRaces.get(result.raceId);
      if (!race) continue;
      const driver = drivers.find((item) => item.id === result.driverId);
      const car = cars.find((item) => item.id === result.carId);
      const track = tracks.find((item) => item.id === race.trackId);
      history.push({
        raceId: result.raceId,
        racedAt: race.racedAt,
        trackId: race.trackId,
        trackName: track?.name,
        championshipId: race.championshipId,
        championshipName: race.championshipId
          ? championshipNames.get(race.championshipId)
          : undefined,
        driverId: result.driverId,
        driverName: driver ? formatDriverName(driver) : result.driverId,
        carId: result.carId,
        carName: car?.name ?? result.carId,
        carColorHex: car?.colorHex,
        gridPosition: result.gridPosition,
        position: result.position,
        pointsAwarded: result.pointsAwarded,
      });
    }
    return history.sort((a, b) =>
      (b.racedAt ?? '').localeCompare(a.racedAt ?? '')
    );
  }

  private breakdown(
    history: ResultHistoryRow[],
    keyFn: (row: ResultHistoryRow) => {
      id: string;
      label: string;
      colorHex?: string;
    }
  ): BreakdownStatRow[] {
    const grouped = new Map<
      string,
      BreakdownStatRow & { finishSum: number; finishCount: number }
    >();
    for (const row of history) {
      const key = keyFn(row);
      const current = grouped.get(key.id) ?? {
        id: key.id,
        label: key.label,
        colorHex: key.colorHex,
        races: 0,
        wins: 0,
        podiums: 0,
        points: 0,
        avgFinish: null,
        bestFinish: null,
        finishSum: 0,
        finishCount: 0,
      };
      current.races += 1;
      current.points += row.pointsAwarded;
      if (row.position === 1) current.wins += 1;
      if (row.position <= 3) current.podiums += 1;
      current.finishSum += row.position;
      current.finishCount += 1;
      current.bestFinish =
        current.bestFinish === null
          ? row.position
          : Math.min(current.bestFinish, row.position);
      grouped.set(key.id, current);
    }
    return [...grouped.values()]
      .map(({ finishSum, finishCount, ...row }) => ({
        ...row,
        avgFinish: finishCount ? finishSum / finishCount : null,
      }))
      .sort((a, b) => b.points - a.points || b.wins - a.wins);
  }
}
