import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  Car,
  Championship,
  Driver,
  RaceResultPayload,
  Track,
} from '../../core/models/domain.models';
import { CarsService } from '../../core/services/cars.service';
import { ChampionshipsService } from '../../core/services/championships.service';
import { DriversService } from '../../core/services/drivers.service';
import { RacesService } from '../../core/services/races.service';
import { TracksService } from '../../core/services/tracks.service';

interface ResultDraft {
  driverId: string;
  carId: string;
  gridPosition: number;
  position: number;
  dnf: boolean;
  carLocked: boolean;
}

@Component({
  selector: 'app-log-race',
  standalone: true,
  imports: [FormsModule, NgClass],
  templateUrl: './log-race.component.html',
  styleUrl: './log-race.component.css',
})
export class LogRaceComponent implements OnInit {
  private readonly carsService = inject(CarsService);
  private readonly driversService = inject(DriversService);
  private readonly tracksService = inject(TracksService);
  private readonly championshipsService = inject(ChampionshipsService);
  private readonly racesService = inject(RacesService);
  private readonly router = inject(Router);

  readonly cars = signal<Car[]>([]);
  readonly drivers = signal<Driver[]>([]);
  readonly tracks = signal<Track[]>([]);
  readonly championships = signal<Championship[]>([]);
  readonly results = signal<ResultDraft[]>([]);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);

  readonly raceType = signal<'championship' | 'standalone'>('championship');
  readonly championshipId = signal('');
  trackId = '';
  roundNumber: number | null = null;
  weatherCondition = '';

  readonly selectedChampionship = computed(
    () =>
      this.championships().find((c) => c.id === this.championshipId()) ?? null
  );

  readonly showWeather = computed(() => {
    if (this.raceType() === 'standalone') return true;
    return !!this.selectedChampionship()?.useWeather;
  });

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const [cars, drivers, tracks, championships] = await Promise.all([
        this.carsService.list(),
        this.driversService.list(),
        this.tracksService.list(),
        this.championshipsService.listActive(),
      ]);
      this.cars.set(cars);
      this.drivers.set(drivers);
      this.tracks.set(tracks);
      this.championships.set(championships);
      if (championships[0]) {
        this.championshipId.set(championships[0].id);
      }
      this.addResultRow();
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Failed to load race form data.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  addResultRow(): void {
    const next = this.results().length + 1;
    this.results.update((rows) => [
      ...rows,
      {
        driverId: '',
        carId: '',
        gridPosition: next,
        position: next,
        dnf: false,
        carLocked: false,
      },
    ]);
  }

  removeResultRow(index: number): void {
    this.results.update((rows) => rows.filter((_, i) => i !== index));
  }

  onDriverChange(index: number, driverId: string): void {
    const driver = this.drivers().find((d) => d.id === driverId);
    this.results.update((rows) =>
      rows.map((row, i) => {
        if (i !== index) return row;
        if (driver?.isLegend) {
          const fixed = driver.fixedCarId ?? '';
          const carExists = this.cars().some((c) => c.id === fixed);
          return {
            ...row,
            driverId,
            carId: carExists ? fixed : '',
            carLocked: true,
          };
        }
        return { ...row, driverId, carLocked: false };
      })
    );
  }

  onCarChange(index: number, carId: string): void {
    this.results.update((rows) =>
      rows.map((row, i) => (i === index ? { ...row, carId } : row))
    );
  }

  updateField<K extends keyof ResultDraft>(
    index: number,
    field: K,
    value: ResultDraft[K]
  ): void {
    this.results.update((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  pointsPreview(row: ResultDraft): number {
    if (this.raceType() === 'standalone') return 0;
    const championship = this.selectedChampionship();
    if (!championship) return 0;
    return this.racesService.pointsForPosition(
      championship.pointSystem,
      row.position,
      row.dnf
    );
  }

  async submit(): Promise<void> {
    this.error.set(null);
    this.success.set(null);
    this.saving.set(true);

    try {
      if (!this.trackId) throw new Error('Select a track.');
      if (this.raceType() === 'championship' && !this.championshipId()) {
        throw new Error('Select an active championship.');
      }

      const drafts = this.results();
      for (const row of drafts) {
        if (!row.driverId || !row.carId) {
          throw new Error('Each entry needs a driver and a car.');
        }
        const driver = this.drivers().find((d) => d.id === row.driverId);
        if (driver?.isLegend) {
          if (!driver.fixedCarId) {
            throw new Error(
              `Legend ${driver.name} has no fixed car assigned.`
            );
          }
          if (row.carId !== driver.fixedCarId) {
            throw new Error(
              `Legend ${driver.name} must use their fixed car.`
            );
          }
        }
      }

      const championship = this.selectedChampionship();
      const payloadResults: RaceResultPayload[] = drafts.map((row) => ({
        driverId: row.driverId,
        carId: row.carId,
        gridPosition: Number(row.gridPosition),
        position: Number(row.position),
        dnf: row.dnf,
        pointsAwarded:
          this.raceType() === 'championship' && championship
            ? this.racesService.pointsForPosition(
                championship.pointSystem,
                Number(row.position),
                row.dnf
              )
            : 0,
      }));

      this.racesService.validateResults(payloadResults);

      await this.racesService.logRace({
        championshipId:
          this.raceType() === 'championship'
            ? this.championshipId()
            : undefined,
        trackId: this.trackId,
        raceType: this.raceType(),
        weatherCondition: this.showWeather()
          ? this.weatherCondition || undefined
          : undefined,
        roundNumber:
          this.raceType() === 'championship' && this.roundNumber
            ? this.roundNumber
            : undefined,
        results: payloadResults,
      });

      this.success.set('Race logged successfully.');
      setTimeout(() => this.router.navigateByUrl('/dashboard'), 800);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to log race.');
    } finally {
      this.saving.set(false);
    }
  }
}
