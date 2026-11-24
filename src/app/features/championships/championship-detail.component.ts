import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  Car,
  Championship,
  ChampionshipEntry,
  ChampionshipProgression,
  ConstructorStandingRow,
  Driver,
  GarageUpgrade,
  Race,
  RaceResultDetailRow,
  SeriesChampionRow,
  StandingRow,
  Track,
} from '../../core/models/domain.models';
import { ChampionshipsService } from '../../core/services/championships.service';
import { RacesService } from '../../core/services/races.service';
import { TracksService } from '../../core/services/tracks.service';
import { CarsService } from '../../core/services/cars.service';
import { DriversService } from '../../core/services/drivers.service';
import { GarageUpgradesService } from '../../core/services/garage-upgrades.service';
import { SessionService } from '../../core/services/session.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TrackRaffleModalComponent } from '../../shared/components/track-raffle/track-raffle-modal.component';
import {
  SearchableSelectComponent,
  SearchableSelectOption,
} from '../../shared/components/searchable-select/searchable-select.component';
import { formatDriverName } from '../../core/utils/driver-display';

type StandingsView = 'table' | 'chart';
type StandingsTab = 'drivers' | 'constructors';
type CalendarView = 'list' | 'table';

interface ChartPoint {
  x: number;
  y: number;
}

interface ChartSeriesPath {
  driverId: string;
  abbreviation: string;
  color: string;
  points: ChartPoint[];
  path: string;
}

interface ChartLayout {
  width: number;
  height: number;
  padL: number;
  padR: number;
  padT: number;
  padB: number;
  maxPoints: number;
  plotW: number;
  plotH: number;
  rounds: number[];
  yTicks: number[];
  series: ChartSeriesPath[];
}

@Component({
  selector: 'app-championship-detail',
  standalone: true,
  imports: [
    RouterLink,
    FormsModule,
    TranslatePipe,
    TrackRaffleModalComponent,
    SearchableSelectComponent,
  ],
  templateUrl: './championship-detail.component.html',
  styleUrl: './championship-detail.component.css',
})
export class ChampionshipDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly championshipsService = inject(ChampionshipsService);
  private readonly racesService = inject(RacesService);
  private readonly tracksService = inject(TracksService);
  private readonly carsService = inject(CarsService);
  private readonly driversService = inject(DriversService);
  private readonly garageService = inject(GarageUpgradesService);
  private readonly i18n = inject(I18nService);
  readonly session = inject(SessionService);

  readonly championship = signal<Championship | null>(null);
  readonly races = signal<Race[]>([]);
  readonly standings = signal<StandingRow[]>([]);
  readonly constructorStandings = signal<ConstructorStandingRow[]>([]);
  readonly entries = signal<ChampionshipEntry[]>([]);
  readonly championshipCarIds = signal<string[]>([]);
  readonly allDrivers = signal<Driver[]>([]);
  readonly allCars = signal<Car[]>([]);
  readonly upgrades = signal<GarageUpgrade[]>([]);
  readonly previousChampionId = signal<string | null>(null);
  readonly computingTitleFight = signal(false);
  readonly entryError = signal<string | null>(null);
  readonly savingEntry = signal(false);
  readonly progression = signal<ChampionshipProgression>({
    rounds: [],
    series: [],
  });
  readonly hall = signal<SeriesChampionRow[]>([]);
  readonly tracks = signal<Track[]>([]);
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);

  readonly standingsTab = signal<StandingsTab>('drivers');
  readonly standingsView = signal<StandingsView>('table');
  readonly calendarView = signal<CalendarView>('list');

  // --- entries form draft ---
  readonly entryDriverId = signal('');
  readonly entryCarId = signal('');
  readonly entryNumber = signal<number | null>(null);
  readonly entryAbbreviation = signal('');
  readonly editingEntryId = signal<string | null>(null);

  /** Host-only edits while the championship is still open. */
  readonly canEditEntries = computed(() => {
    const c = this.championship();
    return !!c && this.session.isHost() && c.isActive && !c.finishedAt;
  });

  readonly showGarageUpgrades = computed(
    () => !!this.championship()?.useGarage
  );

  readonly entryDriverOptions = computed((): SearchableSelectOption[] => {
    this.i18n.lang();
    const editing = this.editingEntryId();
    const taken = new Set(
      this.entries()
        .filter((e) => e.id !== editing)
        .map((e) => e.driverId)
    );
    const legend = this.i18n.t('logRace.legend');
    return this.allDrivers().map((d) => ({
      value: d.id,
      label: `${formatDriverName(d)}${d.isLegend ? ` ${legend}` : ''}`,
      disabled: taken.has(d.id),
    }));
  });

  /** Championship cars that are free (or already held by the entry being edited). */
  readonly entryCarOptions = computed((): SearchableSelectOption[] => {
    const editing = this.editingEntryId();
    const used = new Set(
      this.entries()
        .filter((e) => e.id !== editing)
        .map((e) => e.carId)
    );
    const allowed = new Set(this.championshipCarIds());
    return this.allCars()
      .filter((c) => allowed.has(c.id))
      .map((c) => ({ value: c.id, label: c.name, disabled: used.has(c.id) }));
  });

  readonly selectedEntryDriver = computed(
    () => this.allDrivers().find((d) => d.id === this.entryDriverId()) ?? null
  );

  raffleRaceId: string | null = null;
  readonly raceModal = signal<{
    race: Race;
    results: RaceResultDetailRow[];
    loading: boolean;
  } | null>(null);

  readonly formatDriverName = formatDriverName;

  readonly leaderPoints = computed(
    () => this.standings()[0]?.points ?? 0
  );

  readonly chartLayout = computed<ChartLayout | null>(() => {
    const prog = this.progression();
    if (!prog.rounds.length || !prog.series.length) return null;

    const width = Math.max(560, 96 + prog.rounds.length * 88);
    const height = 280;
    const padL = 56;
    const padR = 24;
    const padT = 20;
    const padB = 44;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;
    const maxPoints = Math.max(
      1,
      ...prog.series.flatMap((s) => s.pointsAfterRound)
    );
    const yTicks = this.buildTicks(maxPoints);

    const xForIndex = (index: number): number => {
      if (prog.rounds.length === 1) return padL + plotW / 2;
      return padL + (index / (prog.rounds.length - 1)) * plotW;
    };
    const yForPts = (pts: number): number =>
      padT + plotH - (pts / maxPoints) * plotH;

    const series: ChartSeriesPath[] = prog.series.map((s) => {
      const points: ChartPoint[] = s.pointsAfterRound.map((pts, i) => ({
        x: xForIndex(i),
        y: yForPts(pts),
      }));
      const path = points
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(' ');
      return {
        driverId: s.driverId,
        abbreviation: s.abbreviation,
        color: s.color,
        points,
        path,
      };
    });

    return {
      width,
      height,
      padL,
      padR,
      padT,
      padB,
      maxPoints,
      plotW,
      plotH,
      rounds: prog.rounds.map((r) => r.roundNumber),
      yTicks,
      series,
    };
  });

  readonly matrixDrivers = computed(() => this.progression().series);

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    await this.load(id);
  }

  trackName(id?: string): string {
    if (!id) return '—';
    return this.tracks().find((t) => t.id === id)?.name ?? id;
  }

  pointsGap(row: StandingRow): string {
    const leader = this.leaderPoints();
    if (row.points === leader) return '—';
    return `−${leader - row.points}`;
  }

  setStandingsView(view: StandingsView): void {
    this.standingsView.set(view);
  }

  setStandingsTab(tab: StandingsTab): void {
    this.standingsTab.set(tab);
  }

  /** Marks which drivers can still win the title; cleared on the next reload. */
  async computeTitleFight(): Promise<void> {
    const c = this.championship();
    if (!c) return;
    this.computingTitleFight.set(true);
    this.error.set(null);
    try {
      this.standings.set(await this.championshipsService.computeTitleFight(c.id));
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Failed to compute title fight.'
      );
    } finally {
      this.computingTitleFight.set(false);
    }
  }

  // ---------------------------------------------------------------- entries

  driverName(driverId: string): string {
    const d = this.allDrivers().find((x) => x.id === driverId);
    return d ? formatDriverName(d) : driverId;
  }

  isLegendDriver(driverId: string): boolean {
    return !!this.allDrivers().find((x) => x.id === driverId)?.isLegend;
  }

  carName(carId: string): string {
    return this.allCars().find((c) => c.id === carId)?.name ?? carId;
  }

  carColor(carId: string): string {
    return this.allCars().find((c) => c.id === carId)?.colorHex ?? '#888';
  }

  onEntryDriverChange(driverId: string): void {
    this.entryDriverId.set(driverId);
    const driver = this.allDrivers().find((d) => d.id === driverId);
    if (!driver) return;
    const free = new Set(
      this.entryCarOptions()
        .filter((o) => !o.disabled)
        .map((o) => o.value)
    );
    if (driver.isLegend) {
      this.entryCarId.set(
        driver.fixedCarId && free.has(driver.fixedCarId) ? driver.fixedCarId : ''
      );
    } else if (
      !this.entryCarId() ||
      !free.has(this.entryCarId())
    ) {
      const fav = driver.favoriteCarId;
      this.entryCarId.set(fav && free.has(fav) ? fav : '');
    }
  }

  resetEntryForm(): void {
    this.editingEntryId.set(null);
    this.entryDriverId.set('');
    this.entryCarId.set('');
    this.entryNumber.set(null);
    this.entryAbbreviation.set('');
    this.entryError.set(null);
  }

  startEditEntry(entry: ChampionshipEntry): void {
    if (!this.canEditEntries()) return;
    this.editingEntryId.set(entry.id);
    this.entryDriverId.set(entry.driverId);
    this.entryCarId.set(entry.carId);
    this.entryNumber.set(entry.number);
    this.entryAbbreviation.set(entry.abbreviation);
    this.entryError.set(null);
  }

  private async validateEntryDraft(
    c: Championship
  ): Promise<{ driverId: string; carId: string; number: number; abbreviation: string }> {
    const driver = this.selectedEntryDriver();
    const carId = this.entryCarId();
    if (!driver || !carId) throw new Error(this.i18n.t('logRace.errorDriverCar'));
    if (driver.isLegend && driver.fixedCarId && carId !== driver.fixedCarId) {
      throw new Error(this.i18n.t('championships.errorLegendCar'));
    }
    const number = Number(this.entryNumber());
    if (!Number.isInteger(number) || number < 1) {
      throw new Error(this.i18n.t('championships.errorEntryNumber'));
    }
    const abbreviation = this.entryAbbreviation().trim().toUpperCase();
    if (!abbreviation) {
      throw new Error(this.i18n.t('championships.errorEntryAbbreviation'));
    }
    const others = this.entries().filter((e) => e.driverId !== driver.id);
    if (others.some((e) => e.carId === carId)) {
      throw new Error(this.i18n.t('championships.errorEntryCarTaken'));
    }
    if (others.some((e) => e.number === number)) {
      throw new Error(this.i18n.t('championships.errorEntryNumberTaken'));
    }
    if (others.some((e) => e.abbreviation.toUpperCase() === abbreviation)) {
      throw new Error(this.i18n.t('championships.errorEntryAbbreviationTaken'));
    }
    if (number === 1 && !driver.isLegend) {
      const champion = await this.championshipsService.getPreviousSeriesChampionDriverId(
        c.seriesId,
        c.editionNumber
      );
      this.previousChampionId.set(champion);
      if (champion !== driver.id) {
        throw new Error(this.i18n.t('championships.errorNumberOne'));
      }
    }
    return { driverId: driver.id, carId, number, abbreviation };
  }

  async saveEntry(): Promise<void> {
    const c = this.championship();
    if (!c || !this.canEditEntries()) return;
    this.entryError.set(null);
    this.savingEntry.set(true);
    try {
      const draft = await this.validateEntryDraft(c);
      await this.championshipsService.upsertEntry(c.id, draft);
      this.resetEntryForm();
      await this.refreshEntries(c.id);
    } catch (err) {
      this.entryError.set(
        err instanceof Error ? err.message : 'Failed to save entry.'
      );
    } finally {
      this.savingEntry.set(false);
    }
  }

  async deleteEntry(entry: ChampionshipEntry): Promise<void> {
    const c = this.championship();
    if (!c || !this.canEditEntries()) return;
    if (!confirm(this.i18n.t('championships.confirmRemoveEntry'))) return;
    this.entryError.set(null);
    try {
      await this.championshipsService.removeEntry(c.id, entry.id);
      if (this.editingEntryId() === entry.id) this.resetEntryForm();
      await this.refreshEntries(c.id);
    } catch (err) {
      this.entryError.set(
        err instanceof Error ? err.message : 'Failed to remove entry.'
      );
    }
  }

  hasUpgrade(entry: ChampionshipEntry, upgradeId: string): boolean {
    return (entry.garageUpgradeIds ?? []).includes(upgradeId);
  }

  async toggleEntryUpgrade(
    entry: ChampionshipEntry,
    upgradeId: string,
    input: HTMLInputElement
  ): Promise<void> {
    const checked = input.checked;
    const c = this.championship();
    if (!c || !this.canEditEntries()) {
      input.checked = !checked;
      return;
    }
    const current = entry.garageUpgradeIds ?? [];
    const next = checked
      ? current.includes(upgradeId)
        ? current
        : [...current, upgradeId]
      : current.filter((id) => id !== upgradeId);
    this.entryError.set(null);
    try {
      const updated = await this.championshipsService.setEntryUpgrades(
        c.id,
        entry.id,
        next
      );
      this.entries.update((list) =>
        list.map((e) => (e.id === updated.id ? updated : e))
      );
    } catch (err) {
      this.entryError.set(
        err instanceof Error ? err.message : 'Failed to save upgrades.'
      );
      input.checked = !checked;
    }
  }

  private async refreshEntries(championshipId: string): Promise<void> {
    const [entries, carIds] = await Promise.all([
      this.championshipsService.listEntries(championshipId),
      this.championshipsService.listCars(championshipId),
    ]);
    this.entries.set(entries);
    this.championshipCarIds.set(carIds);
  }

  setCalendarView(view: CalendarView): void {
    this.calendarView.set(view);
  }

  finishInRace(driverId: string, race: Race): string {
    if (race.status !== 'completed') return '—';
    const prog = this.progression();
    const idx = prog.rounds.findIndex((r) => r.raceId === race.id);
    if (idx < 0) return '—';
    const series = prog.series.find((s) => s.driverId === driverId);
    if (!series) return '—';
    const pos = series.finishPositionByRound[idx];
    return pos == null ? '—' : String(pos);
  }

  shortTrackLabel(race: Race): string {
    const name = this.trackName(race.trackId);
    if (name === '—') return `E${race.roundNumber ?? '?'}`;
    return name.length > 14 ? `${name.slice(0, 12)}…` : name;
  }

  async load(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const championship = await this.championshipsService.getById(id);
      if (!championship) throw new Error('Championship not found.');
      const [
        races,
        standings,
        constructors,
        progression,
        hall,
        tracks,
        entries,
        carIds,
        drivers,
        cars,
        upgrades,
        previousChampionId,
      ] = await Promise.all([
        this.championshipsService.listRaces(id),
        this.championshipsService.getStandings(id),
        this.championshipsService.getConstructorStandings(id),
        this.championshipsService.getProgression(id),
        this.championshipsService.getSeriesChampions(championship.seriesId),
        this.tracksService.list(),
        this.championshipsService.listEntries(id),
        this.championshipsService.listCars(id),
        this.driversService.list(),
        this.carsService.list(),
        this.garageService.list(),
        this.championshipsService.getPreviousSeriesChampionDriverId(
          championship.seriesId,
          championship.editionNumber
        ),
      ]);
      this.championship.set(championship);
      this.races.set(races);
      // Reloading standings drops any previously computed title-fight flags.
      this.standings.set(standings);
      this.constructorStandings.set(constructors);
      this.entries.set(entries);
      this.championshipCarIds.set(carIds);
      this.allDrivers.set(drivers);
      this.allCars.set(cars);
      this.upgrades.set(upgrades);
      this.previousChampionId.set(previousChampionId);
      this.progression.set(progression);
      this.hall.set(hall);
      this.tracks.set(tracks);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load.');
    } finally {
      this.loading.set(false);
    }
  }

  async openRaceResults(race: Race): Promise<void> {
    if (race.status !== 'completed') return;
    this.raceModal.set({ race, results: [], loading: true });
    try {
      const [raw, drivers, cars] = await Promise.all([
        this.racesService.listResultsByRace(race.id),
        this.driversService.list(),
        this.carsService.list(),
      ]);
      const results: RaceResultDetailRow[] = raw.map((r) => {
        const driver = drivers.find((d) => d.id === r.driverId);
        const car = cars.find((c) => c.id === r.carId);
        return {
          driverId: r.driverId,
          driverName: driver?.name ?? r.driverId,
          nickname: driver?.nickname,
          carId: r.carId,
          carName: car?.name ?? r.carId,
          carColorHex: car?.colorHex,
          gridPosition: r.gridPosition,
          position: r.position,
          pointsAwarded: r.pointsAwarded,
        };
      });
      this.raceModal.set({ race, results, loading: false });
    } catch (err) {
      this.raceModal.set(null);
      this.error.set(
        err instanceof Error ? err.message : 'Failed to load race results.'
      );
    }
  }

  closeRaceModal(): void {
    this.raceModal.set(null);
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

  private buildTicks(max: number): number[] {
    if (max <= 5) return Array.from({ length: max + 1 }, (_, i) => i);
    const step = Math.max(1, Math.ceil(max / 5));
    const ticks: number[] = [];
    for (let v = 0; v <= max; v += step) ticks.push(v);
    if (ticks[ticks.length - 1] !== max) ticks.push(max);
    return ticks;
  }
}
