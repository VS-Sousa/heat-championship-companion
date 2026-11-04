import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  CarStatRow,
  Championship,
  DriverStatRow,
  GlobalChampionRow,
  StandingRow,
  Track,
} from '../../core/models/domain.models';
import { ChampionshipsService } from '../../core/services/championships.service';
import { RacesService } from '../../core/services/races.service';
import { TracksService } from '../../core/services/tracks.service';
import { SessionService } from '../../core/services/session.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { formatDriverName } from '../../core/utils/driver-display';
import {
  DriverKindFilter,
  DriverKindFilterComponent,
} from '../../shared/components/driver-kind-filter/driver-kind-filter.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink, DecimalPipe, TranslatePipe, DriverKindFilterComponent],
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
  readonly hall = signal<GlobalChampionRow[]>([]);
  readonly selectedChampionshipId = signal<string | null>(null);
  readonly hallFilter = signal<DriverKindFilter>('human');
  readonly formFilter = signal<DriverKindFilter>('human');

  readonly unfinishedChampionships = computed(() =>
    this.championships().filter((c) => c.isActive && !c.finishedAt)
  );

  readonly filteredHall = computed(() =>
    this.filterByKind(this.hall(), this.hallFilter())
  );

  readonly filteredDriverStats = computed(() =>
    this.filterByKind(this.driverStats(), this.formFilter())
  );

  readonly formatDriverName = formatDriverName;

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [championships, drivers, cars, tracks, hall] = await Promise.all([
        this.championshipsService.list(),
        this.racesService.getDriverStats(),
        this.racesService.getCarStats(),
        this.tracksService.list(),
        this.championshipsService.getGlobalChampionsHall(),
      ]);

      this.championships.set(championships);
      this.driverStats.set(drivers.slice(0, 24));
      this.carStats.set(cars.slice(0, 8));
      this.tracks.set(tracks);
      this.hall.set(hall);

      const unfinished = championships.filter((c) => c.isActive && !c.finishedAt);
      const first = unfinished[0] ?? null;
      if (first) {
        this.selectedChampionshipId.set(first.id);
        this.standings.set(
          await this.championshipsService.getStandings(first.id)
        );
      } else {
        this.selectedChampionshipId.set(null);
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
    if (!id) return;
    this.selectedChampionshipId.set(id);
    try {
      this.standings.set(await this.championshipsService.getStandings(id));
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Failed to load standings.'
      );
    }
  }

  showTitleFight(): boolean {
    return !!this.selectedChampionshipId();
  }

  private filterByKind<T extends { isLegend: boolean }>(
    rows: T[],
    filter: DriverKindFilter
  ): T[] {
    const filtered =
      filter === 'human'
        ? rows.filter((r) => !r.isLegend)
        : filter === 'legend'
          ? rows.filter((r) => r.isLegend)
          : rows;
    return filtered.slice(0, 8);
  }
}
