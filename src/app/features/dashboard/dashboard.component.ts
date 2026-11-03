import { Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  CarStatRow,
  Championship,
  DriverStatRow,
  StandingRow,
  Track,
} from '../../core/models/domain.models';
import { ChampionshipsService } from '../../core/services/championships.service';
import { RacesService } from '../../core/services/races.service';
import { TracksService } from '../../core/services/tracks.service';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, DecimalPipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  private readonly championshipsService = inject(ChampionshipsService);
  private readonly racesService = inject(RacesService);
  private readonly tracksService = inject(TracksService);
  readonly session = inject(SessionService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly championships = signal<Championship[]>([]);
  readonly standings = signal<StandingRow[]>([]);
  readonly driverStats = signal<DriverStatRow[]>([]);
  readonly carStats = signal<CarStatRow[]>([]);
  readonly tracks = signal<Track[]>([]);
  readonly selectedChampionshipId = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [championships, drivers, cars, tracks] = await Promise.all([
        this.championshipsService.list(),
        this.racesService.getDriverStats(),
        this.racesService.getCarStats(),
        this.tracksService.list(),
      ]);

      this.championships.set(championships);
      this.driverStats.set(drivers.slice(0, 8));
      this.carStats.set(cars.slice(0, 8));
      this.tracks.set(tracks);

      const active =
        championships.find((c) => c.isActive) ?? championships[0] ?? null;
      this.selectedChampionshipId.set(active?.id ?? null);
      if (active) {
        this.standings.set(
          await this.championshipsService.getStandings(active.id)
        );
      } else {
        this.standings.set([]);
      }
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Failed to load dashboard.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  async onChampionshipChange(id: string): Promise<void> {
    this.selectedChampionshipId.set(id || null);
    if (!id) {
      this.standings.set([]);
      return;
    }
    try {
      this.standings.set(await this.championshipsService.getStandings(id));
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Failed to load standings.'
      );
    }
  }

  trackName(id: string): string {
    return this.tracks().find((t) => t.id === id)?.name ?? id;
  }
}
