import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ScoringSystemsService } from '../../core/services/scoring-systems.service';
import {
  Car,
  Championship,
  PlannedRoundInput,
  ScoringSystem,
  Track,
} from '../../core/models/domain.models';
import { ChampionshipsService } from '../../core/services/championships.service';
import { TracksService } from '../../core/services/tracks.service';
import { CarsService } from '../../core/services/cars.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TrackRaffleModalComponent } from '../../shared/components/track-raffle/track-raffle-modal.component';
import { SearchableSelectComponent } from '../../shared/components/searchable-select/searchable-select.component';
import { I18nService } from '../../core/i18n/i18n.service';

interface CalendarDraft {
  roundNumber: number;
  trackId: string;
}

@Component({
  selector: 'app-championship-form',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    TranslatePipe,
    TrackRaffleModalComponent,
    SearchableSelectComponent,
  ],
  templateUrl: './championship-form.component.html',
  styleUrl: './championships.component.css',
})
export class ChampionshipFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly championshipsService = inject(ChampionshipsService);
  private readonly tracksService = inject(TracksService);
  private readonly carsService = inject(CarsService);
  private readonly scoringSystemsService = inject(ScoringSystemsService);
  private readonly i18n = inject(I18nService);

  readonly editingId: string | null = this.route.snapshot.paramMap.get('id');
  readonly isEdit = this.editingId !== null;

  readonly championships = signal<Championship[]>([]);
  readonly tracks = signal<Track[]>([]);
  readonly cars = signal<Car[]>([]);
  readonly scoringSystems = signal<ScoringSystem[]>([]);
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly notFound = signal(false);

  readonly name = signal('');
  readonly scoringSystemId = signal('');
  /** Selected car ids (create) or the championship's cars (edit, display-only). */
  readonly carIds = signal<string[]>([]);
  readonly useGarage = signal(false);
  readonly successionOfId = signal('');
  readonly calendar = signal<CalendarDraft[]>([{ roundNumber: 1, trackId: '' }]);
  readonly raffleRoundIndex = signal<number | null>(null);

  private existing: Championship | null = null;

  readonly successionOptions = computed(() => {
    this.i18n.lang();
    return [
      { value: '', label: this.i18n.t('championships.newSeries') },
      ...this.championships().map((c) => ({
        value: c.id,
        label: `${c.name} · E${c.editionNumber}`,
      })),
    ];
  });

  readonly trackOptions = computed(() => {
    this.i18n.lang();
    return [
      { value: '', label: this.i18n.t('championships.trackOptional') },
      ...this.tracks().map((track) => ({
        value: track.id,
        label: track.name,
      })),
    ];
  });

  readonly scoringSystemOptions = computed(() =>
    this.scoringSystems().map((s) => ({ value: s.id, label: s.name }))
  );

  readonly selectedScoringSystem = computed(
    () =>
      this.scoringSystems().find((s) => s.id === this.scoringSystemId()) ?? null
  );

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [championships, tracks, scoringSystems, cars] = await Promise.all([
        this.championshipsService.list(),
        this.tracksService.list(),
        this.scoringSystemsService.list(),
        this.carsService.list(),
      ]);
      this.championships.set(championships);
      this.tracks.set(tracks);
      this.scoringSystems.set(scoringSystems);
      this.cars.set(cars);

      if (this.editingId) {
        const existing = championships.find((c) => c.id === this.editingId);
        if (!existing) {
          this.notFound.set(true);
          this.error.set(this.i18n.t('championships.notFound'));
          return;
        }
        this.existing = existing;
        this.name.set(existing.name);
        this.scoringSystemId.set(existing.scoringSystemId);
        this.useGarage.set(existing.useGarage);
        this.carIds.set(await this.championshipsService.listCars(existing.id));
      } else if (scoringSystems[0]) {
        // Default: first scoring system selected.
        this.scoringSystemId.set(scoringSystems[0].id);
      }
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Failed to load championship form.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  isCarSelected(carId: string): boolean {
    return this.carIds().includes(carId);
  }

  toggleCar(carId: string, checked: boolean): void {
    if (this.isEdit) return;
    const has = this.carIds().includes(carId);
    if (checked && !has) this.carIds.update((ids) => [...ids, carId]);
    if (!checked && has) {
      this.carIds.update((ids) => ids.filter((id) => id !== carId));
    }
  }

  addRound(): void {
    this.calendar.update((rounds) => [
      ...rounds,
      { roundNumber: rounds.length + 1, trackId: '' },
    ]);
  }

  removeRound(index: number): void {
    if (this.calendar().length <= 1) return;
    this.calendar.update((rounds) =>
      rounds
        .filter((_, i) => i !== index)
        .map((round, i) => ({ ...round, roundNumber: i + 1 }))
    );
  }

  setRoundTrack(index: number, trackId: string): void {
    this.calendar.update((rounds) =>
      rounds.map((round, i) => (i === index ? { ...round, trackId } : round))
    );
  }

  openRaffle(index: number): void {
    this.raffleRoundIndex.set(index);
  }

  closeRaffle(): void {
    this.raffleRoundIndex.set(null);
  }

  onTrackRaffled(trackId: string): void {
    const index = this.raffleRoundIndex();
    if (index === null) return;
    this.setRoundTrack(index, trackId);
    this.raffleRoundIndex.set(null);
  }

  async save(): Promise<void> {
    this.error.set(null);
    try {
      const name = this.name().trim();
      if (!name) {
        throw new Error(this.i18n.t('championships.errorNameRequired'));
      }
      const scoring = this.selectedScoringSystem();
      if (!scoring) {
        throw new Error(this.i18n.t('championships.errorScoringRequired'));
      }
      if (!this.isEdit && !this.carIds().length) {
        throw new Error(this.i18n.t('championships.errorCarsRequired'));
      }
      const pointSystem = [...scoring.points];
      if (!pointSystem.length) {
        throw new Error('Point system must include at least one value.');
      }

      this.saving.set(true);
      const season = this.resolveSeason();

      if (this.editingId) {
        await this.championshipsService.update(this.editingId, {
          name,
          season,
          pointSystem,
          scoringSystemId: scoring.id,
          useGarage: this.useGarage(),
          useEvents: false,
          usePress: false,
          useSponsorship: false,
          isActive: this.existing?.isActive ?? true,
        });
      } else {
        const calendar: PlannedRoundInput[] = this.calendar().map((round) => ({
          roundNumber: round.roundNumber,
          trackId: round.trackId || undefined,
        }));
        await this.championshipsService.createWithCalendar({
          name,
          season,
          pointSystem,
          scoringSystemId: scoring.id,
          carIds: [...this.carIds()],
          useGarage: this.useGarage(),
          useEvents: false,
          usePress: false,
          useSponsorship: false,
          successionOfId: this.successionOfId() || undefined,
          calendar,
        });
      }
      await this.router.navigate(['/championships']);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      this.saving.set(false);
    }
  }

  private resolveSeason(): string {
    if (this.existing) {
      return this.existing.season || String(new Date().getFullYear());
    }
    const successionOfId = this.successionOfId();
    if (successionOfId) {
      const previous = this.championships().find((c) => c.id === successionOfId);
      const year = Number(previous?.season);
      if (previous && !Number.isNaN(year)) return String(year + 1);
    }
    return String(new Date().getFullYear());
  }
}
