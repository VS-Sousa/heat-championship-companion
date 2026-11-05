import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Championship,
  PlannedRoundInput,
  StandingRow,
  Track,
} from '../../core/models/domain.models';
import { ChampionshipsService } from '../../core/services/championships.service';
import { TracksService } from '../../core/services/tracks.service';
import { SessionService } from '../../core/services/session.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TrackRaffleModalComponent } from '../../shared/components/track-raffle/track-raffle-modal.component';
import { SearchableSelectComponent } from '../../shared/components/searchable-select/searchable-select.component';
import { formatDriverName } from '../../core/utils/driver-display';
import { I18nService } from '../../core/i18n/i18n.service';

const DEFAULT_POINTS = '10,8,6,5,4,3,2,1';

interface CalendarDraft {
  roundNumber: number;
  trackId: string;
}

@Component({
  selector: 'app-championships',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    TranslatePipe,
    TrackRaffleModalComponent,
    SearchableSelectComponent,
  ],
  templateUrl: './championships.component.html',
  styleUrl: './championships.component.css',
})
export class ChampionshipsComponent implements OnInit {
  private readonly championshipsService = inject(ChampionshipsService);
  private readonly tracksService = inject(TracksService);
  private readonly i18n = inject(I18nService);
  readonly session = inject(SessionService);

  readonly championships = signal<Championship[]>([]);
  readonly tracks = signal<Track[]>([]);
  readonly standings = signal<StandingRow[]>([]);
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);
  readonly formOpen = signal(false);

  readonly sortedChampionships = computed(() => {
    const list = [...this.championships()];
    return list.sort((a, b) => {
      const aFinished = !a.isActive || !!a.finishedAt;
      const bFinished = !b.isActive || !!b.finishedAt;
      if (aFinished !== bFinished) return aFinished ? 1 : -1;
      return 0;
    });
  });

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

  editingId: string | null = null;
  viewingId: string | null = null;
  name = '';
  pointSystemText = DEFAULT_POINTS;
  useGarage = false;
  useEvents = false;
  usePress = false;
  useSponsorship = false;
  successionOfId = '';
  calendar: CalendarDraft[] = [{ roundNumber: 1, trackId: '' }];
  raffleRoundIndex: number | null = null;

  readonly formatDriverName = formatDriverName;

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [championships, tracks] = await Promise.all([
        this.championshipsService.list(),
        this.tracksService.list(),
      ]);
      this.championships.set(championships);
      this.tracks.set(tracks);
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Failed to load championships.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  resetForm(): void {
    this.editingId = null;
    this.name = '';
    this.pointSystemText = DEFAULT_POINTS;
    this.useGarage = false;
    this.useEvents = false;
    this.usePress = false;
    this.useSponsorship = false;
    this.successionOfId = '';
    this.calendar = [{ roundNumber: 1, trackId: '' }];
    this.raffleRoundIndex = null;
  }

  startCreate(): void {
    this.resetForm();
    this.formOpen.set(true);
  }

  startEdit(c: Championship): void {
    this.editingId = c.id;
    this.name = c.name;
    this.pointSystemText = c.pointSystem.join(',');
    this.useGarage = c.useGarage;
    this.useEvents = c.useEvents;
    this.usePress = c.usePress;
    this.useSponsorship = c.useSponsorship;
    this.successionOfId = '';
    this.calendar = [{ roundNumber: 1, trackId: '' }];
    this.raffleRoundIndex = null;
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.resetForm();
  }

  addRound(): void {
    this.calendar = [
      ...this.calendar,
      { roundNumber: this.calendar.length + 1, trackId: '' },
    ];
  }

  removeRound(index: number): void {
    if (this.calendar.length <= 1) return;
    this.calendar = this.calendar
      .filter((_, i) => i !== index)
      .map((round, i) => ({ ...round, roundNumber: i + 1 }));
  }

  openRaffle(index: number): void {
    this.raffleRoundIndex = index;
  }

  closeRaffle(): void {
    this.raffleRoundIndex = null;
  }

  onTrackRaffled(trackId: string): void {
    if (this.raffleRoundIndex === null) return;
    this.calendar = this.calendar.map((round, i) =>
      i === this.raffleRoundIndex ? { ...round, trackId } : round
    );
    this.raffleRoundIndex = null;
  }

  async viewStandings(c: Championship): Promise<void> {
    this.viewingId = c.id;
    try {
      this.standings.set(await this.championshipsService.getStandings(c.id));
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Failed to load standings.'
      );
    }
  }

  async finalize(c: Championship): Promise<void> {
    if (!confirm(`Finalize "${c.name}"?`)) return;
    try {
      await this.championshipsService.finalizeChampionship(c.id);
      await this.reload();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Finalize failed.');
    }
  }

  async save(): Promise<void> {
    this.error.set(null);
    try {
      const pointSystem = this.pointSystemText
        .split(',')
        .map((v) => Number(v.trim()))
        .filter((n) => !Number.isNaN(n));

      if (!this.name.trim()) {
        throw new Error('Name is required.');
      }
      if (!pointSystem.length) {
        throw new Error('Point system must include at least one value.');
      }

      const season = await this.resolveSeason(this.editingId, this.successionOfId);

      if (this.editingId) {
        await this.championshipsService.update(this.editingId, {
          name: this.name.trim(),
          season,
          pointSystem,
          useGarage: this.useGarage,
          useEvents: this.useEvents,
          usePress: this.usePress,
          useSponsorship: this.useSponsorship,
          isActive: true,
        });
      } else {
        const calendar: PlannedRoundInput[] = this.calendar.map((round) => ({
          roundNumber: round.roundNumber,
          trackId: round.trackId || undefined,
        }));
        await this.championshipsService.createWithCalendar({
          name: this.name.trim(),
          season,
          pointSystem,
          useGarage: this.useGarage,
          useEvents: this.useEvents,
          usePress: this.usePress,
          useSponsorship: this.useSponsorship,
          successionOfId: this.successionOfId || undefined,
          calendar,
        });
      }
      this.closeForm();
      await this.reload();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Save failed.');
    }
  }

  private async resolveSeason(
    editingId: string | null,
    successionOfId: string
  ): Promise<string> {
    if (editingId) {
      const existing = this.championships().find((c) => c.id === editingId);
      return existing?.season || String(new Date().getFullYear());
    }
    if (successionOfId) {
      const previous = this.championships().find((c) => c.id === successionOfId);
      const year = Number(previous?.season);
      if (previous && !Number.isNaN(year)) return String(year + 1);
    }
    return String(new Date().getFullYear());
  }

  async remove(c: Championship): Promise<void> {
    if (!confirm(`Delete championship "${c.name}"?`)) return;
    try {
      await this.championshipsService.remove(c.id);
      if (this.viewingId === c.id) {
        this.viewingId = null;
        this.standings.set([]);
      }
      await this.reload();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Delete failed.');
    }
  }
}
