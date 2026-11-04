import { Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Track, TrackDriverHistoryRow } from '../../core/models/domain.models';
import { TracksService } from '../../core/services/tracks.service';
import { RacesService } from '../../core/services/races.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-track-detail',
  standalone: true,
  imports: [RouterLink, TranslatePipe, DecimalPipe],
  templateUrl: './track-detail.component.html',
})
export class TrackDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly tracksService = inject(TracksService);
  private readonly racesService = inject(RacesService);

  readonly track = signal<Track | null>(null);
  readonly drivers = signal<TrackDriverHistoryRow[]>([]);
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.loading.set(true);
    try {
      const track = await this.tracksService.getById(id);
      if (!track) throw new Error('Track not found.');
      const drivers = await this.racesService.getTrackDriverHistory(id);
      this.track.set(track);
      this.drivers.set(drivers);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load.');
    } finally {
      this.loading.set(false);
    }
  }
}
