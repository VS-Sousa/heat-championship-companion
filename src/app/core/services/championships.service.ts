import { inject, Injectable } from '@angular/core';
import { DATA_PROVIDER } from '../data/data-provider.token';
import {
  Championship,
  ChampionshipProgression,
  CreateChampionshipRequest,
  GlobalChampionRow,
  PlannedRoundInput,
  Race,
  RaceResult,
  SeriesChampionRow,
  StandingRow,
  TitleWin,
} from '../models/domain.models';

@Injectable({ providedIn: 'root' })
export class ChampionshipsService {
  private readonly provider = inject(DATA_PROVIDER);

  list(): Promise<Championship[]> {
    return this.provider.championships.list();
  }

  listActive(): Promise<Championship[]> {
    return this.provider.championships.listActive();
  }

  getById(id: string): Promise<Championship | null> {
    return this.provider.championships.getById(id);
  }

  createWithCalendar(
    input: CreateChampionshipRequest
  ): Promise<Championship> {
    return this.provider.championships.createWithCalendar(input);
  }

  update(
    id: string,
    input: Omit<
      Championship,
      'id' | 'seriesId' | 'editionNumber' | 'finishedAt'
    > & { seriesId?: string; editionNumber?: number }
  ): Promise<Championship> {
    return this.provider.championships.update(id, input);
  }

  remove(id: string): Promise<void> {
    return this.provider.championships.remove(id);
  }

  finalizeChampionship(id: string): Promise<Championship> {
    return this.provider.championships.finalizeChampionship(id);
  }

  listBySeries(seriesId: string): Promise<Championship[]> {
    return this.provider.championships.listBySeries(seriesId);
  }

  listRaces(championshipId: string): Promise<Race[]> {
    return this.provider.championships.listRaces(championshipId);
  }

  listPlannedRaces(championshipId: string): Promise<Race[]> {
    return this.provider.championships.listPlannedRaces(championshipId);
  }

  updatePlannedRaceTrack(
    raceId: string,
    trackId: string | null
  ): Promise<Race> {
    return this.provider.championships.updatePlannedRaceTrack(raceId, trackId);
  }

  addPlannedRounds(
    championshipId: string,
    rounds: PlannedRoundInput[]
  ): Promise<void> {
    return this.provider.championships.addPlannedRounds(
      championshipId,
      rounds
    );
  }

  getStandings(championshipId: string): Promise<StandingRow[]> {
    return this.provider.championships.getStandings(championshipId);
  }

  getProgression(championshipId: string): Promise<ChampionshipProgression> {
    return this.provider.championships.getProgression(championshipId);
  }

  listResultsByRaceIds(
    raceIds: string[]
  ): Promise<Map<string, RaceResult[]>> {
    return this.provider.championships.listResultsByRaceIds(raceIds);
  }

  getOverallStandings(): Promise<StandingRow[]> {
    return this.provider.championships.getOverallStandings();
  }

  getSeriesChampions(seriesId: string): Promise<SeriesChampionRow[]> {
    return this.provider.championships.getSeriesChampions(seriesId);
  }

  getGlobalChampionsHall(): Promise<GlobalChampionRow[]> {
    return this.provider.championships.getGlobalChampionsHall();
  }

  getDriverTitles(driverId: string): Promise<TitleWin[]> {
    return this.provider.championships.getDriverTitles(driverId);
  }

  getCarTitles(carId: string): Promise<TitleWin[]> {
    return this.provider.championships.getCarTitles(carId);
  }

  applyTitleFight(
    standings: StandingRow[],
    pointSystem: number[],
    remainingPlanned: number
  ): StandingRow[] {
    return this.provider.championships.applyTitleFight(
      standings,
      pointSystem,
      remainingPlanned
    );
  }
}
