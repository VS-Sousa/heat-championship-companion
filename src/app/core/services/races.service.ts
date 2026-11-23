import { inject, Injectable } from '@angular/core';
import { DATA_PROVIDER } from '../data/data-provider.token';
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
} from '../models/domain.models';

@Injectable({ providedIn: 'root' })
export class RacesService {
  private readonly provider = inject(DATA_PROVIDER);

  listRecent(limit = 10): Promise<Race[]> {
    return this.provider.races.listRecent(limit);
  }

  getRace(id: string): Promise<Race | null> {
    return this.provider.races.getRace(id);
  }

  listResultsByRace(raceId: string): Promise<RaceResult[]> {
    return this.provider.races.listResultsByRace(raceId);
  }

  completePlannedRace(
    request: CompletePlannedRaceRequest
  ): Promise<Race> {
    return this.provider.races.completePlannedRace(request);
  }

  logStandaloneRace(request: LogStandaloneRaceRequest): Promise<Race> {
    return this.provider.races.logStandaloneRace(request);
  }

  cancelRace(raceId: string): Promise<Race> {
    return this.provider.races.cancelRace(raceId);
  }
  savePreRace(request: SavePreRaceRequest): Promise<Race> { return this.provider.races.savePreRace(request); }
  startLive(raceId: string): Promise<Race> { return this.provider.races.startLive(raceId); }
  saveTelemetry(request: SaveTelemetryRequest): Promise<Race> { return this.provider.races.saveTelemetry(request); }
  openPodium(raceId: string): Promise<Race> { return this.provider.races.openPodium(raceId); }
  completePostRace(request: CompletePostRaceRequest): Promise<Race> { return this.provider.races.completePostRace(request); }

  getDriverStats(): Promise<DriverStatRow[]> {
    return this.provider.races.getDriverStats();
  }

  getCarStats(): Promise<CarStatRow[]> {
    return this.provider.races.getCarStats();
  }

  getDriverResultHistory(driverId: string): Promise<ResultHistoryRow[]> {
    return this.provider.races.getDriverResultHistory(driverId);
  }

  getCarResultHistory(carId: string): Promise<ResultHistoryRow[]> {
    return this.provider.races.getCarResultHistory(carId);
  }

  getDriverBreakdownByCar(driverId: string): Promise<BreakdownStatRow[]> {
    return this.provider.races.getDriverBreakdownByCar(driverId);
  }

  getDriverBreakdownByTrack(driverId: string): Promise<BreakdownStatRow[]> {
    return this.provider.races.getDriverBreakdownByTrack(driverId);
  }

  getCarBreakdownByDriver(carId: string): Promise<BreakdownStatRow[]> {
    return this.provider.races.getCarBreakdownByDriver(carId);
  }

  getCarBreakdownByTrack(carId: string): Promise<BreakdownStatRow[]> {
    return this.provider.races.getCarBreakdownByTrack(carId);
  }

  getTrackDriverHistory(trackId: string): Promise<TrackDriverHistoryRow[]> {
    return this.provider.races.getTrackDriverHistory(trackId);
  }

  getDriverHeadToHead(driverId: string): Promise<HeadToHeadRow[]> {
    return this.provider.races.getDriverHeadToHead(driverId);
  }

  getDriverBestFinish(
    driverId: string
  ): Promise<{ position: number; racedAt?: string; trackName?: string } | null> {
    return this.provider.races.getDriverBestFinish(driverId);
  }

  pointsForPosition(
    pointSystem: number[],
    position: number,
    dnf: boolean
  ): number {
    return this.provider.races.pointsForPosition(
      pointSystem,
      position,
      dnf
    );
  }

  validateResults(
    results: {
      driverId: string;
      carId: string;
      gridPosition: number;
      position: number;
    }[]
  ): void {
    this.provider.races.validateResults(results);
  }
}
