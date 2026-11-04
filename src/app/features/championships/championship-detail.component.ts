import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  Championship,
  Race,
  SeriesChampionRow,
  StandingRow,
  Track,
} from '../../core/models/domain.models';
import { ChampionshipsService } from '../../core/services/championships.service';
import { RacesService } from '../../core/services/races.service';
import { TracksService } from '../../core/services/tracks.service';
import { SessionService } from '../../core/services/session.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TrackRaffleModalComponent } from '../../shared/components/track-raffle/track-raffle-modal.component';
import { formatDriverName } from '../../core/utils/driver-display';

@Component({
  selector: 'app-championship-detail',
  standalone: true,
  imports: [RouterLink, TranslatePipe, TrackRaffleModalComponent],
  templateUrl: './championship-detail.component.html',
})
export class ChampionshipDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly championshipsService = inject(ChampionshipsService);
  private readonly racesService = inject(RacesService);
  private readonly tracksService = inject(TracksService);
  readonly session = inject(SessionService);

  readonly championship = signal<Championship | null>(null);
  readonly races = signal<Race[]>([]);
  readonly standings = signal<StandingRow[]>([]);
  readonly hall = signal<SeriesChampionRow[]>([]);
  readonly tracks = signal<Track[]>([]);
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);
  raffleRaceId: string | null = null;

  readonly formatDriverName = formatDriverName;

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    await this.load(id);
  }

  trackName(id?: string): string {
    if (!id) return '—';
    return this.tracks().find((t) => t.id === id)?.name ?? id;
  }

  async load(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const championship = await this.championshipsService.getById(id);
      if (!championship) throw new Error('Championship not found.');
      const [races, standings, hall, tracks] = await Promise.all([
        this.championshipsService.listRaces(id),
        this.championshipsService.getStandings(id),
        this.championshipsService.getSeriesChampions(championship.seriesId),
        this.tracksService.list(),
      ]);
      this.championship.set(championship);
      this.races.set(races);
      this.standings.set(standings);
      this.hall.set(hall);
      this.tracks.set(tracks);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load.');
    } finally {
      this.loading.set(false);
    }
  }

  async cancelRace(race: Race): Promise<void> {
    if (!confirm('Cancel this race?')) return;
    try {
      await this.racesService.cancelRace(race.id);
      const id = this.championship()?.id;
      if (id) await this.load(id);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Cancel failed.');
    }
  }

  async finalize(): Promise<void> {
    const c = this.championship();
    if (!c || !confirm(`Finalize "${c.name}"?`)) return;
    try {
      await this.championshipsService.finalizeChampionship(c.id);
      await this.load(c.id);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Finalize failed.');
    }
  }

  closeRaffle(): void {
    this.raffleRaceId = null;
  }

  async onTrackRaffled(trackId: string): Promise<void> {
    if (!this.raffleRaceId) return;
    try {
      await this.championshipsService.updatePlannedRaceTrack(
        this.raffleRaceId,
        trackId
      );
      this.raffleRaceId = null;
      const id = this.championship()?.id;
      if (id) await this.load(id);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Raffle save failed.');
    }
  }
}
