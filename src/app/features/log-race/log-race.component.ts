import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  Association,
  Car,
  Championship,
  ChampionshipEntry,
  Driver,
  GarageUpgrade,
  Race,
  RaceEntry,
  ScoringSystem,
  StandingRow,
  TelemetryEvent,
  TelemetryEventType,
  Track,
  TrackCorner,
} from '../../core/models/domain.models';
import { AssociationsService } from '../../core/services/associations.service';
import { CarsService } from '../../core/services/cars.service';
import { ChampionshipsService } from '../../core/services/championships.service';
import { DriversService } from '../../core/services/drivers.service';
import { GarageUpgradesService } from '../../core/services/garage-upgrades.service';
import { RacesService } from '../../core/services/races.service';
import { ScoringSystemsService } from '../../core/services/scoring-systems.service';
import { TracksService } from '../../core/services/tracks.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TrackRaffleModalComponent } from '../../shared/components/track-raffle/track-raffle-modal.component';
import { GridDrawComponent } from '../../shared/components/grid-draw/grid-draw.component';
import {
  SearchableSelectComponent,
  SearchableSelectOption,
} from '../../shared/components/searchable-select/searchable-select.component';
import { GridAssignment } from '../../core/services/grid.service';
import { formatDriverName } from '../../core/utils/driver-display';
import { I18nService } from '../../core/i18n/i18n.service';
import { countryLabel } from '../../core/data/countries';
import { resolveCornerOrder } from '../../core/data/shared/badge-evaluator';

export type WizardStep = 1 | 2 | 3;

interface EntryDraft {
  driverId: string;
  carId: string;
  gridPosition: number;
  loadout: string[];
  carLocked: boolean;
  /** Standalone races only. */
  number: number | null;
  abbreviation: string;
  /** Championship races: driver originally registered for this car. */
  originalDriverId?: string;
}

interface FinishRow {
  driverId: string;
  carId: string;
  gridPosition: number;
  loadout: string[];
  gapTurns: number;
}

export const TELEMETRY_EVENT_TYPES: TelemetryEventType[] = [
  'fastest_turn',
  'slipstream_overtake',
  'corner_speed_ok',
  'corner_spin',
];

const CORNER_EVENT_TYPES: TelemetryEventType[] = [
  'corner_speed_ok',
  'corner_spin',
];

interface DisplayCorner {
  corner: TrackCorner;
  /** Position of the corner in the race sequence (respects reverse direction). */
  raceOrder: number;
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
    SearchableSelectComponent,
  ],
  templateUrl: './log-race.component.html',
  styleUrl: './log-race.component.css',
})
export class LogRaceComponent implements OnInit {
  private readonly carsService = inject(CarsService);
  private readonly driversService = inject(DriversService);
  private readonly tracksService = inject(TracksService);
  private readonly championshipsService = inject(ChampionshipsService);
  private readonly associationsService = inject(AssociationsService);
  private readonly scoringSystemsService = inject(ScoringSystemsService);
  private readonly garageService = inject(GarageUpgradesService);
  private readonly racesService = inject(RacesService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  readonly stepLabels: Array<{ step: WizardStep; key: string }> = [
    { step: 1, key: 'logRace.step1' },
    { step: 2, key: 'logRace.step2' },
    { step: 3, key: 'logRace.step3' },
  ];
  readonly eventTypes = TELEMETRY_EVENT_TYPES;

  // --- wizard state ---
  readonly step = signal<WizardStep>(1);
  readonly raceId = signal<string | null>(null);
  readonly savedRace = signal<Race | null>(null);

  // --- reference data ---
  readonly cars = signal<Car[]>([]);
  readonly drivers = signal<Driver[]>([]);
  readonly tracks = signal<Track[]>([]);
  readonly championships = signal<Championship[]>([]);
  readonly associations = signal<Association[]>([]);
  readonly scoringSystems = signal<ScoringSystem[]>([]);
  readonly upgrades = signal<GarageUpgrade[]>([]);
  readonly plannedRaces = signal<Race[]>([]);
  readonly standings = signal<StandingRow[]>([]);
  /** Registered entries of the selected championship (championship mode). */
  readonly championshipEntries = signal<ChampionshipEntry[]>([]);

  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly showRaffle = signal(false);

  // --- step 1 ---
  readonly entries = signal<EntryDraft[]>([]);
  readonly raceType = signal<'championship' | 'standalone'>('championship');
  readonly championshipId = signal('');
  readonly plannedRaceId = signal('');
  readonly trackId = signal('');
  readonly reverseDirection = signal(false);
  readonly useGarageToggle = signal(false);
  readonly associationId = signal('');
  readonly scoringSystemId = signal('');
  raceName = '';
  raceAbbreviation = '';
  racedAt = new Date().toISOString().slice(0, 10);
  weatherCondition = '';
  useTrackConditions = false;

  // --- step 2 ---
  readonly telemetry = signal<TelemetryEvent[]>([]);
  readonly liveDriverId = signal('');
  readonly liveEventType = signal<TelemetryEventType>('fastest_turn');
  readonly liveCornerOrder = signal<number | null>(null);

  // --- step 3 ---
  readonly finishRows = signal<FinishRow[]>([]);
  readonly driverOfDayId = signal('');

  readonly formatDriverName = formatDriverName;

  readonly selectedChampionship = computed(
    () =>
      this.championships().find((c) => c.id === this.championshipId()) ?? null
  );

  readonly isChampionshipMode = computed(
    () => this.raceType() === 'championship' && !!this.selectedChampionship()
  );

  /** Championship races follow the championship setting; standalone uses the toggle. */
  readonly useGarage = computed(() =>
    this.isChampionshipMode()
      ? !!this.selectedChampionship()?.useGarage
      : this.useGarageToggle()
  );

  readonly selectedTrack = computed(
    () => this.tracks().find((t) => t.id === this.trackId()) ?? null
  );

  readonly selectedDrivers = computed(() => {
    const ids = new Set(
      this.entries()
        .map((r) => r.driverId)
        .filter(Boolean)
    );
    return this.drivers().filter((d) => ids.has(d.id));
  });

  /** Drivers that have an entry saved (used in steps 2/3). */
  readonly raceDrivers = computed(() => {
    const ids = this.entries()
      .map((e) => e.driverId)
      .filter(Boolean);
    return ids
      .map((id) => this.drivers().find((d) => d.id === id))
      .filter((d): d is Driver => !!d);
  });

  /** Corners of the selected track ordered as raced (reverse-aware). */
  readonly displayCorners = computed<DisplayCorner[]>(() => {
    const corners = this.selectedTrack()?.corners ?? [];
    const reverse = this.reverseDirection();
    return corners
      .map((corner) => ({
        corner,
        raceOrder: resolveCornerOrder(corners.length, corner.order, reverse),
      }))
      .sort((a, b) => a.raceOrder - b.raceOrder);
  });

  readonly needsCorner = computed(() =>
    CORNER_EVENT_TYPES.includes(this.liveEventType())
  );

  /** Championship races always use the championship's scoring system. */
  readonly activeScoringSystem = computed(() => {
    const id = this.isChampionshipMode()
      ? (this.selectedChampionship()?.scoringSystemId ?? '')
      : this.scoringSystemId();
    return this.scoringSystems().find((s) => s.id === id) ?? null;
  });

  readonly championshipDefaultScoringLabel = computed(() => {
    const id = this.selectedChampionship()?.scoringSystemId;
    return this.scoringSystems().find((s) => s.id === id)?.name ?? null;
  });

  /** Championship mode needs a planned calendar slot; block continuing when none exists. */
  readonly noPlannedRacesAvailable = computed(() =>
    this.isChampionshipMode() && !this.raceId() && this.plannedRaces().length === 0
  );

  readonly championshipOptions = computed(() =>
    this.championships().map((c) => ({
      value: c.id,
      label: `${c.name} · E${c.editionNumber}`,
    }))
  );

  readonly plannedRaceOptions = computed(() => {
    this.i18n.lang();
    return this.plannedRaces().map((race) => ({
      value: race.id,
      label: `${this.i18n.t('championships.round')} ${race.roundNumber}`,
    }));
  });

  readonly trackOptions = computed(() =>
    this.tracks().map((track) => ({
      value: track.id,
      label: `${track.name} (${countryLabel(track.country, this.i18n.lang())})`,
    }))
  );

  readonly associationOptions = computed((): SearchableSelectOption[] => {
    this.i18n.lang();
    return [
      { value: '', label: this.i18n.t('associations.fiaOption') },
      ...this.associations().map((a) => ({
        value: a.id,
        label: a.name,
      })),
    ];
  });

  /** Standalone races: required, no empty option. */
  readonly scoringOptions = computed((): SearchableSelectOption[] =>
    this.scoringSystems().map((s) => ({ value: s.id, label: s.name }))
  );

  readonly weatherOptions = computed((): SearchableSelectOption[] => {
    this.i18n.lang();
    return [
      { value: '', label: '—' },
      { value: 'clear', label: this.i18n.t('logRace.weatherClear') },
      { value: 'cloudy', label: this.i18n.t('logRace.weatherCloudy') },
      { value: 'rain', label: this.i18n.t('logRace.weatherRain') },
      { value: 'heavy_rain', label: this.i18n.t('logRace.weatherHeavy') },
    ];
  });

  readonly driverOfDayOptions = computed((): SearchableSelectOption[] => {
    this.i18n.lang();
    return [
      { value: '', label: this.i18n.t('logRace.noDriverOfDay') },
      ...this.finishRows().map((row) => ({
        value: row.driverId,
        label: this.driverLabel(row.driverId),
      })),
    ];
  });

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const [
        cars,
        drivers,
        tracks,
        championships,
        associations,
        scoringSystems,
        upgrades,
      ] = await Promise.all([
        this.carsService.list(),
        this.driversService.list(),
        this.tracksService.list(),
        this.championshipsService.listActive(),
        this.associationsService.list(),
        this.scoringSystemsService.list(),
        this.garageService.list(),
      ]);
      this.cars.set(cars);
      this.drivers.set(drivers);
      this.tracks.set(tracks);
      this.championships.set(championships);
      this.associations.set(associations);
      this.scoringSystems.set(scoringSystems);
      this.upgrades.set(upgrades);
      // Standalone scoring is required; preselect the first system.
      if (scoringSystems[0]) this.scoringSystemId.set(scoringSystems[0].id);
      if (championships[0]) {
        this.championshipId.set(championships[0].id);
        await this.loadPlanned(championships[0].id);
        await this.loadChampionshipEntries(championships[0].id);
      } else {
        this.raceType.set('standalone');
        this.resetStandaloneEntries();
      }
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Failed to load race form data.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  // ---------------------------------------------------------------- step 1

  async setRaceType(type: 'championship' | 'standalone'): Promise<void> {
    if (this.raceType() === type) return;
    this.raceType.set(type);
    this.error.set(null);
    try {
      if (type === 'championship') {
        await this.loadChampionshipEntries(this.championshipId());
      } else {
        this.resetStandaloneEntries();
      }
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Failed to load entries.'
      );
    }
  }

  async onChampionshipChange(id: string): Promise<void> {
    this.championshipId.set(id);
    this.plannedRaceId.set('');
    this.trackId.set('');
    try {
      await this.loadPlanned(id);
      await this.loadChampionshipEntries(id);
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Failed to load championship.'
      );
    }
  }

  /** Prefill the grid from the championship's registered entries (cars locked). */
  private async loadChampionshipEntries(championshipId: string): Promise<void> {
    if (!championshipId) {
      this.championshipEntries.set([]);
      this.entries.set([]);
      return;
    }
    const list = await this.championshipsService.listEntries(championshipId);
    this.championshipEntries.set(list);
    this.entries.set(list.map((e, i) => this.draftFromEntry(e, i + 1)));
  }

  private draftFromEntry(entry: ChampionshipEntry, gridPosition: number): EntryDraft {
    return {
      driverId: entry.driverId,
      carId: entry.carId,
      gridPosition,
      loadout: this.loadoutForEntry(entry),
      carLocked: true,
      number: entry.number,
      abbreviation: entry.abbreviation,
      originalDriverId: entry.driverId,
    };
  }

  /** Humans bring their registered garage upgrades; legends never do. */
  private loadoutForEntry(entry: ChampionshipEntry): string[] {
    const driver = this.drivers().find((d) => d.id === entry.driverId);
    if (!driver || driver.isLegend) return [];
    return [...(entry.garageUpgradeIds ?? [])];
  }

  private resetStandaloneEntries(): void {
    this.entries.set([]);
    this.addEntryRow();
  }

  entryFor(row: EntryDraft): ChampionshipEntry | undefined {
    return this.championshipEntries().find(
      (e) => e.driverId === row.originalDriverId
    );
  }

  isSubstituted(row: EntryDraft): boolean {
    return !!row.originalDriverId && row.driverId !== row.originalDriverId;
  }

  /** Legend that owns this row's car and can stand in for a human driver. */
  substituteCandidate(index: number): Driver | null {
    if (!this.isChampionshipMode()) return null;
    const row = this.entries()[index];
    if (!row || this.isSubstituted(row)) return null;
    const current = this.drivers().find((d) => d.id === row.driverId);
    if (!current || current.isLegend) return null;
    return (
      this.drivers().find(
        (d) =>
          d.isLegend &&
          d.fixedCarId === row.carId &&
          !this.entries().some((r) => r.driverId === d.id)
      ) ?? null
    );
  }

  /** Swap a human entry for the legend bound to the same car (car is kept). */
  substituteDriver(index: number): void {
    const legend = this.substituteCandidate(index);
    if (!legend) return;
    this.entries.update((rows) =>
      rows.map((row, i) =>
        i === index ? { ...row, driverId: legend.id, loadout: [] } : row
      )
    );
  }

  undoSubstitute(index: number): void {
    this.entries.update((rows) =>
      rows.map((row, i) => {
        if (i !== index || !row.originalDriverId) return row;
        const entry = this.entryFor(row);
        return {
          ...row,
          driverId: row.originalDriverId,
          loadout: entry ? this.loadoutForEntry(entry) : [],
        };
      })
    );
  }

  upgradeName(id: string): string {
    return this.upgrades().find((u) => u.id === id)?.name ?? id;
  }

  onPlannedRaceChange(id: string): void {
    this.plannedRaceId.set(id);
    const race = this.plannedRaces().find((r) => r.id === id);
    this.trackId.set(race?.trackId ?? '');
    if (race?.reverseDirection !== undefined) {
      this.reverseDirection.set(!!race.reverseDirection);
    }
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
      this.trackId.set(planned[0].trackId ?? '');
    }
  }

  addEntryRow(): void {
    const next = this.entries().length + 1;
    this.entries.update((rows) => [
      ...rows,
      {
        driverId: '',
        carId: '',
        gridPosition: next,
        loadout: [],
        carLocked: false,
        number: null,
        abbreviation: '',
      },
    ]);
  }

  removeEntryRow(index: number): void {
    this.entries.update((rows) => rows.filter((_, i) => i !== index));
  }

  onDriverChange(index: number, driverId: string): void {
    const driver = this.drivers().find((d) => d.id === driverId);
    this.entries.update((rows) => {
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

  driverOptions(rowIndex: number): SearchableSelectOption[] {
    this.i18n.lang();
    const row = this.entries()[rowIndex];
    return this.drivers().map((driver) => {
      const legend = driver.isLegend ? ` ${this.i18n.t('logRace.legend')}` : '';
      return {
        value: driver.id,
        label: `${formatDriverName(driver)}${legend}`,
        disabled:
          (this.isDriverTaken(driver.id, rowIndex) && row?.driverId !== driver.id) ||
          (this.isLegendCarBlocked(driver, rowIndex) && row?.driverId !== driver.id),
      };
    });
  }

  carOptions(rowIndex: number): SearchableSelectOption[] {
    const row = this.entries()[rowIndex];
    return this.cars().map((car) => ({
      value: car.id,
      label: car.name,
      disabled: this.isCarTaken(car.id, rowIndex) && row?.carId !== car.id,
    }));
  }

  isCarTaken(carId: string, rowIndex: number): boolean {
    if (!carId) return false;
    return this.entries().some((r, i) => i !== rowIndex && r.carId === carId);
  }

  isDriverTaken(driverId: string, rowIndex: number): boolean {
    if (!driverId) return false;
    return this.entries().some(
      (r, i) => i !== rowIndex && r.driverId === driverId
    );
  }

  /** Legend whose fixed car is already used by another row. */
  isLegendCarBlocked(driver: Driver, rowIndex: number): boolean {
    if (!driver.isLegend || !driver.fixedCarId) return false;
    return this.isCarTaken(driver.fixedCarId, rowIndex);
  }

  onCarChange(index: number, carId: string): void {
    this.entries.update((rows) => {
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

  updateEntry<K extends keyof EntryDraft>(
    index: number,
    field: K,
    value: EntryDraft[K]
  ): void {
    this.entries.update((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  toggleLoadout(index: number, upgradeId: string, checked: boolean): void {
    this.entries.update((rows) =>
      rows.map((row, i) => {
        if (i !== index) return row;
        const has = row.loadout.includes(upgradeId);
        if (checked && !has) {
          return { ...row, loadout: [...row.loadout, upgradeId] };
        }
        if (!checked && has) {
          return { ...row, loadout: row.loadout.filter((u) => u !== upgradeId) };
        }
        return row;
      })
    );
  }

  onGridAssigned(assignments: GridAssignment[]): void {
    const byDriver = new Map(assignments.map((a) => [a.driverId, a.gridPosition]));
    this.entries.update((rows) =>
      rows.map((row) =>
        row.driverId && byDriver.has(row.driverId)
          ? { ...row, gridPosition: byDriver.get(row.driverId)! }
          : row
      )
    );
  }

  onTrackRaffled(trackId: string): void {
    this.trackId.set(trackId);
    this.showRaffle.set(false);
  }

  private validateStep1(): void {
    if (!this.trackId()) throw new Error(this.i18n.t('logRace.errorTrack'));
    if (!this.racedAt) throw new Error(this.i18n.t('logRace.errorDate'));
    if (!this.raceName.trim() || !this.raceAbbreviation.trim()) {
      throw new Error(this.i18n.t('logRace.errorRaceName'));
    }
    if (this.raceType() === 'championship') {
      if (!this.championshipId()) {
        throw new Error(this.i18n.t('logRace.errorChampionship'));
      }
      if (!this.plannedRaceId()) {
        throw new Error(this.i18n.t('logRace.errorPlanned'));
      }
    }
    if (this.raceType() === 'standalone' && !this.scoringSystemId()) {
      throw new Error(this.i18n.t('logRace.errorScoring'));
    }
    const rows = this.entries();
    if (!rows.length) throw new Error(this.i18n.t('logRace.errorEntries'));
    if (this.raceType() === 'standalone') {
      for (const row of rows) {
        const num = Number(row.number);
        if (!Number.isInteger(num) || num < 1 || !row.abbreviation.trim()) {
          throw new Error(this.i18n.t('logRace.errorNumberAbbr'));
        }
      }
      if (
        new Set(rows.map((r) => Number(r.number))).size !== rows.length ||
        new Set(rows.map((r) => r.abbreviation.trim().toUpperCase())).size !==
          rows.length
      ) {
        throw new Error(this.i18n.t('logRace.errorNumberAbbrDuplicate'));
      }
    }
    for (const row of rows) {
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
    if (
      new Set(rows.map((r) => r.driverId)).size !== rows.length ||
      new Set(rows.map((r) => r.carId)).size !== rows.length
    ) {
      throw new Error(this.i18n.t('logRace.errorDuplicate'));
    }
  }

  /** Step 1 → save pre-race, start live, go to step 2. */
  async saveAndContinue(): Promise<void> {
    this.error.set(null);
    this.success.set(null);
    this.saving.set(true);
    try {
      this.validateStep1();

      const useGarage = this.useGarage();
      const championshipMode = this.raceType() === 'championship';
      const entries: RaceEntry[] = this.entries().map((row) => ({
        driverId: row.driverId,
        carId: row.carId,
        // Championship races take number/abbreviation from championship entries.
        ...(championshipMode
          ? {}
          : {
              number: Number(row.number),
              abbreviation: row.abbreviation.trim().toUpperCase(),
            }),
        gridPosition: Number(row.gridPosition),
        loadout: useGarage ? row.loadout : [],
      }));

      const pre = await this.racesService.savePreRace({
        raceId:
          this.raceId() ??
          (championshipMode ? this.plannedRaceId() || undefined : undefined),
        championshipId: championshipMode ? this.championshipId() : undefined,
        associationId: this.associationId() || undefined,
        trackId: this.trackId(),
        reverseDirection: this.reverseDirection(),
        name: this.raceName.trim(),
        abbreviation: this.raceAbbreviation.trim().toUpperCase(),
        // Championship races use the championship's scoring system.
        scoringSystemId: championshipMode
          ? undefined
          : this.scoringSystemId() || undefined,
        weatherCondition: this.weatherCondition || undefined,
        trackCondition: this.useTrackConditions ? 'enabled' : undefined,
        racedAt: this.racedAt,
        useGarage,
        entries,
      });
      this.raceId.set(pre.id);

      const live = await this.racesService.startLive(pre.id);
      this.savedRace.set(live);
      this.telemetry.set(live.telemetry ?? []);
      this.liveDriverId.set('');
      this.liveCornerOrder.set(null);
      this.step.set(2);
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Failed to save pre-race.'
      );
    } finally {
      this.saving.set(false);
    }
  }

  // ---------------------------------------------------------------- step 2

  driverLabel(driverId: string): string {
    const driver = this.drivers().find((d) => d.id === driverId);
    return driver ? formatDriverName(driver) : driverId;
  }

  driverShortLabel(driver: Driver): string {
    return driver.nickname?.trim() || driver.name;
  }

  carColorForDriver(driverId: string): string {
    const carId = this.entries().find((e) => e.driverId === driverId)?.carId;
    return (carId && this.carById(carId)?.colorHex) || 'transparent';
  }

  selectLiveDriver(driverId: string): void {
    this.liveDriverId.set(this.liveDriverId() === driverId ? '' : driverId);
  }

  selectEventType(type: TelemetryEventType): void {
    this.liveEventType.set(type);
    if (!CORNER_EVENT_TYPES.includes(type)) {
      this.liveCornerOrder.set(null);
    }
  }

  cornerName(order?: number): string {
    if (order === undefined) return '';
    return (
      this.selectedTrack()?.corners?.find((c) => c.order === order)?.name ??
      `#${order}`
    );
  }

  eventCount(driverId: string): number {
    return this.telemetry().filter((e) => e.driverId === driverId).length;
  }

  async logEvent(): Promise<void> {
    this.error.set(null);
    const driverId = this.liveDriverId();
    if (!driverId) {
      this.error.set(this.i18n.t('telemetry.errorDriver'));
      return;
    }
    const type = this.liveEventType();
    const cornerOrder = this.liveCornerOrder();
    if (this.needsCorner() && cornerOrder === null) {
      this.error.set(this.i18n.t('telemetry.errorCorner'));
      return;
    }
    const event: TelemetryEvent = {
      id: crypto.randomUUID(),
      driverId,
      type,
      cornerOrder: this.needsCorner() ? cornerOrder ?? undefined : undefined,
      createdAt: new Date().toISOString(),
    };
    this.telemetry.update((list) => [...list, event]);
    await this.persistTelemetry();
  }

  async undoLastEvent(): Promise<void> {
    if (!this.telemetry().length) return;
    this.telemetry.update((list) => list.slice(0, -1));
    await this.persistTelemetry();
  }

  private async persistTelemetry(): Promise<void> {
    const raceId = this.raceId();
    if (!raceId) return;
    try {
      await this.racesService.saveTelemetry({
        raceId,
        telemetry: this.telemetry(),
      });
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Failed to save telemetry.'
      );
    }
  }

  /** Step 2 → open podium, go to step 3. */
  async goToPodium(): Promise<void> {
    const raceId = this.raceId();
    if (!raceId) return;
    this.error.set(null);
    this.saving.set(true);
    try {
      await this.racesService.saveTelemetry({
        raceId,
        telemetry: this.telemetry(),
      });
      const race = await this.racesService.openPodium(raceId);
      this.savedRace.set(race);

      const entries = [...this.entries()].sort(
        (a, b) => a.gridPosition - b.gridPosition
      );
      this.finishRows.set(
        entries.map((e) => ({
          driverId: e.driverId,
          carId: e.carId,
          gridPosition: Number(e.gridPosition),
          loadout: this.useGarage() ? e.loadout : [],
          gapTurns: 0,
        }))
      );
      this.driverOfDayId.set('');
      this.step.set(3);
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Failed to open podium.'
      );
    } finally {
      this.saving.set(false);
    }
  }

  backToPreRace(): void {
    this.error.set(null);
    this.step.set(1);
  }

  // ---------------------------------------------------------------- step 3

  moveFinishRow(index: number, delta: -1 | 1): void {
    this.finishRows.update((rows) => {
      const target = index + delta;
      if (target < 0 || target >= rows.length) return rows;
      const next = [...rows];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  updateFinishRow<K extends keyof FinishRow>(
    index: number,
    field: K,
    value: FinishRow[K]
  ): void {
    this.finishRows.update((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  }

  /** Points for a finish row given the active scoring system or championship fallback. */
  pointsPreview(row: FinishRow, index: number): number {
    const position = index + 1;
    const system = this.activeScoringSystem();
    const fallback = this.isChampionshipMode()
      ? this.selectedChampionship()?.pointSystem
      : undefined;
    const table = system?.points ?? fallback;
    if (!table) return 0;
    let points = this.racesService.pointsForPosition(table, position);
    if (system) {
      if (row.gridPosition === 1) points += system.bonusPole;
      if (this.driverOfDayId() === row.driverId) {
        points += system.bonusDriverOfDay;
      }
    }
    return points;
  }

  async submitPostRace(): Promise<void> {
    const raceId = this.raceId();
    if (!raceId) return;
    this.error.set(null);
    this.success.set(null);
    this.saving.set(true);
    try {
      const rows = this.finishRows();
      const payload = rows.map((row, i) => ({
        driverId: row.driverId,
        carId: row.carId,
        gridPosition: Number(row.gridPosition),
        position: i + 1,
        pointsAwarded: this.pointsPreview(row, i),
        gapTurns: Number(row.gapTurns) || 0,
        driverOfTheDay: this.driverOfDayId() === row.driverId,
        loadout: row.loadout,
      }));
      this.racesService.validateResults(payload);
      await this.racesService.completePostRace({ raceId, results: payload });
      this.success.set(this.i18n.t('logRace.success'));

      const championship = this.isChampionshipMode()
        ? this.selectedChampionship()
        : null;
      if (championship) {
        const remaining = (
          await this.championshipsService.listPlannedRaces(championship.id)
        ).length;
        if (remaining === 0 && championship.isActive) {
          if (confirm(this.i18n.t('logRace.askFinalize'))) {
            await this.championshipsService.finalizeChampionship(championship.id);
          }
        }
      }

      const target = championship
        ? `/championships/${championship.id}`
        : '/dashboard';
      setTimeout(() => this.router.navigateByUrl(target), 800);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to log race.');
    } finally {
      this.saving.set(false);
    }
  }
}
