import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  Car,
  Championship,
  Driver,
  Race,
  RaceResultPayload,
  StandingRow,
  Track,
} from '../../core/models/domain.models';
import { CarsService } from '../../core/services/cars.service';
import { ChampionshipsService } from '../../core/services/championships.service';
import { DriversService } from '../../core/services/drivers.service';
import { RacesService } from '../../core/services/races.service';
import { TracksService } from '../../core/services/tracks.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TrackRaffleModalComponent } from '../../shared/components/track-raffle/track-raffle-modal.component';
import { GridDrawComponent } from '../../shared/components/grid-draw/grid-draw.component';
import { GridAssignment } from '../../core/services/grid.service';
import { formatDriverName } from '../../core/utils/driver-display';
import { I18nService } from '../../core/i18n/i18n.service';

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
  imports: [
    FormsModule,
    NgClass,
    TranslatePipe,
    TrackRaffleModalComponent,
    GridDrawComponent,
  ],
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
  private readonly i18n = inject(I18nService);

  readonly cars = signal<Car[]>([]);
  readonly drivers = signal<Driver[]>([]);
  readonly tracks = signal<Track[]>([]);
  readonly championships = signal<Championship[]>([]);
  readonly plannedRaces = signal<Race[]>([]);
  readonly standings = signal<StandingRow[]>([]);
  readonly results = signal<ResultDraft[]>([]);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly showRaffle = signal(false);

  readonly raceType = signal<'championship' | 'standalone'>('championship');
  readonly championshipId = signal('');
  readonly plannedRaceId = signal('');
  trackId = '';
  racedAt = new Date().toISOString().slice(0, 10);
  weatherCondition = '';
  useTrackConditions = false;

  readonly formatDriverName = formatDriverName;

  readonly selectedChampionship = computed(
    () =>
      this.championships().find((c) => c.id === this.championshipId()) ?? null
  );

  readonly selectedPlannedRace = computed(
    () => this.plannedRaces().find((r) => r.id === this.plannedRaceId()) ?? null
  );

  readonly selectedDrivers = computed(() => {
    const ids = new Set(
      this.results()
        .map((r) => r.driverId)
        .filter(Boolean)
    );
    return this.drivers().filter((d) => ids.has(d.id));
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
        await this.loadPlanned(championships[0].id);
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

  async onChampionshipChange(id: string): Promise<void> {
    this.championshipId.set(id);
    this.plannedRaceId.set('');
    this.trackId = '';
    await this.loadPlanned(id);
  }

  async onPlannedRaceChange(id: string): Promise<void> {
    this.plannedRaceId.set(id);
    const race = this.plannedRaces().find((r) => r.id === id);
    this.trackId = race?.trackId ?? '';
  }

  private async loadPlanned(championshipId: string): Promise<void> {
    if (!championshipId) {
      this.plannedRaces.set([]);
      this.standings.set([]);
      return;
    }
    const [planned, standings] = await Promise.all([
      this.championshipsService.listPlannedRaces(championshipId),
      this.championshipsService.getStandings(championshipId),
    ]);
    this.plannedRaces.set(planned);
    this.standings.set(standings);
    if (planned[0]) {
      this.plannedRaceId.set(planned[0].id);
      this.trackId = planned[0].trackId ?? '';
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
    this.results.update((rows) => {
      let next = rows.map((row, i) => {
        if (i !== index) return row;
        if (!driverId) {
          return { ...row, driverId: '', carId: '', carLocked: false };
        }
        if (driver?.isLegend) {
          const fixed = driver.fixedCarId ?? '';
          const carExists = !!fixed && this.cars().some((c) => c.id === fixed);
          return {
            ...row,
            driverId,
            carId: carExists ? fixed : '',
            carLocked: true,
          };
        }
        const favorite = driver?.favoriteCarId ?? '';
        const favoriteFree =
          !!favorite &&
          this.cars().some((c) => c.id === favorite) &&
          !rows.some((r, j) => j !== index && r.carId === favorite);
        return {
          ...row,
          driverId,
          carId: favoriteFree ? favorite : '',
          carLocked: false,
        };
      });

      const claimed = next[index]?.carId;
      if (claimed) {
        next = next.map((row, i) =>
          i !== index && row.carId === claimed ? { ...row, carId: '' } : row
        );
      }
      return next;
    });
  }

  carById(carId: string): Car | undefined {
    return this.cars().find((c) => c.id === carId);
  }

  isCarTaken(carId: string, rowIndex: number): boolean {
    if (!carId) return false;
    return this.results().some((r, i) => i !== rowIndex && r.carId === carId);
  }

  isDriverTaken(driverId: string, rowIndex: number): boolean {
    if (!driverId) return false;
    return this.results().some(
      (r, i) => i !== rowIndex && r.driverId === driverId
    );
  }

  /** Legend whose fixed car is already used by another row. */
  isLegendCarBlocked(driver: Driver, rowIndex: number): boolean {
    if (!driver.isLegend || !driver.fixedCarId) return false;
    return this.isCarTaken(driver.fixedCarId, rowIndex);
  }

  onCarChange(index: number, carId: string): void {
    this.results.update((rows) => {
      if (carId) {
        const conflict = rows.findIndex(
          (r, i) => i !== index && r.carId === carId
        );
        if (conflict >= 0 && rows[conflict].carLocked) {
          return rows;
        }
      }
      return rows.map((row, i) => {
        if (i === index) return { ...row, carId };
        if (carId && row.carId === carId) return { ...row, carId: '' };
        return row;
      });
    });
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

  onGridAssigned(assignments: GridAssignment[]): void {
    const byDriver = new Map(assignments.map((a) => [a.driverId, a.gridPosition]));
    this.results.update((rows) =>
      rows.map((row) =>
        row.driverId && byDriver.has(row.driverId)
          ? { ...row, gridPosition: byDriver.get(row.driverId)! }
          : row
      )
    );
  }

  onTrackRaffled(trackId: string): void {
    this.trackId = trackId;
    this.showRaffle.set(false);
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
      if (!this.trackId) throw new Error(this.i18n.t('logRace.errorTrack'));
      if (!this.racedAt) throw new Error(this.i18n.t('logRace.errorDate'));
      if (this.raceType() === 'championship') {
        if (!this.championshipId()) {
          throw new Error(this.i18n.t('logRace.errorChampionship'));
        }
        if (!this.plannedRaceId()) {
          throw new Error(this.i18n.t('logRace.errorPlanned'));
        }
      }

      const drafts = this.results();
      for (const row of drafts) {
        if (!row.driverId || !row.carId) {
          throw new Error(this.i18n.t('logRace.errorDriverCar'));
        }
        const driver = this.drivers().find((d) => d.id === row.driverId);
        if (driver?.isLegend) {
          if (!driver.fixedCarId || row.carId !== driver.fixedCarId) {
            throw new Error(
              `Legend ${formatDriverName(driver)} must use their fixed car.`
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

      if (this.raceType() === 'championship') {
        await this.racesService.completePlannedRace({
          raceId: this.plannedRaceId(),
          trackId: this.trackId,
          weatherCondition: this.weatherCondition || undefined,
          trackCondition: this.useTrackConditions ? 'enabled' : undefined,
          racedAt: this.racedAt,
          results: payloadResults,
        });

        const remaining = (
          await this.championshipsService.listPlannedRaces(this.championshipId())
        ).length;
        this.success.set(this.i18n.t('logRace.success'));

        if (remaining === 0 && championship?.isActive) {
          const finish = confirm(this.i18n.t('logRace.askFinalize'));
          if (finish) {
            await this.championshipsService.finalizeChampionship(
              this.championshipId()
            );
          }
        }
      } else {
        await this.racesService.logStandaloneRace({
          trackId: this.trackId,
          weatherCondition: this.weatherCondition || undefined,
          trackCondition: this.useTrackConditions ? 'enabled' : undefined,
          racedAt: this.racedAt,
          results: payloadResults,
        });
        this.success.set(this.i18n.t('logRace.success'));
      }

      setTimeout(() => this.router.navigateByUrl('/dashboard'), 800);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to log race.');
    } finally {
      this.saving.set(false);
    }
  }
}
