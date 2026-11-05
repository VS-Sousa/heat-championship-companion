import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  Championship,
  ChampionshipProgression,
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
import { SessionService } from '../../core/services/session.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TrackRaffleModalComponent } from '../../shared/components/track-raffle/track-raffle-modal.component';
import { formatDriverName } from '../../core/utils/driver-display';

type StandingsView = 'table' | 'chart';
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
  imports: [RouterLink, TranslatePipe, TrackRaffleModalComponent],
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
  readonly session = inject(SessionService);

  readonly championship = signal<Championship | null>(null);
  readonly races = signal<Race[]>([]);
  readonly standings = signal<StandingRow[]>([]);
  readonly progression = signal<ChampionshipProgression>({
    rounds: [],
    series: [],
  });
  readonly hall = signal<SeriesChampionRow[]>([]);
  readonly tracks = signal<Track[]>([]);
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);

  readonly standingsView = signal<StandingsView>('table');
  readonly calendarView = signal<CalendarView>('list');

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
    if (series.dnfByRound[idx]) return 'DNF';
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
      const [races, standings, progression, hall, tracks] = await Promise.all([
        this.championshipsService.listRaces(id),
        this.championshipsService.getStandings(id),
        this.championshipsService.getProgression(id),
        this.championshipsService.getSeriesChampions(championship.seriesId),
        this.tracksService.list(),
      ]);
      this.championship.set(championship);
      this.races.set(races);
      this.standings.set(standings);
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
          dnf: r.dnf,
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
