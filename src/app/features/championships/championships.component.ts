import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Championship, StandingRow } from '../../core/models/domain.models';
import { ChampionshipsService } from '../../core/services/championships.service';
import { SessionService } from '../../core/services/session.service';

const DEFAULT_POINTS = '10,8,6,5,4,3,2,1';

@Component({
  selector: 'app-championships',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './championships.component.html',
  styleUrl: './championships.component.css',
})
export class ChampionshipsComponent implements OnInit {
  private readonly championshipsService = inject(ChampionshipsService);
  readonly session = inject(SessionService);

  readonly championships = signal<Championship[]>([]);
  readonly standings = signal<StandingRow[]>([]);
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);

  editingId: string | null = null;
  viewingId: string | null = null;
  name = '';
  season = '';
  pointSystemText = DEFAULT_POINTS;
  useGarage = false;
  useWeather = false;
  useLegends = false;
  useHeavyRain = false;
  isActive = true;

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.championships.set(await this.championshipsService.list());
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Failed to load championships.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  startCreate(): void {
    this.editingId = null;
    this.name = '';
    this.season = '';
    this.pointSystemText = DEFAULT_POINTS;
    this.useGarage = false;
    this.useWeather = false;
    this.useLegends = false;
    this.useHeavyRain = false;
    this.isActive = true;
  }

  startEdit(c: Championship): void {
    this.editingId = c.id;
    this.name = c.name;
    this.season = c.season;
    this.pointSystemText = c.pointSystem.join(',');
    this.useGarage = c.useGarage;
    this.useWeather = c.useWeather;
    this.useLegends = c.useLegends;
    this.useHeavyRain = c.useHeavyRain;
    this.isActive = c.isActive;
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

  async save(): Promise<void> {
    this.error.set(null);
    try {
      const pointSystem = this.pointSystemText
        .split(',')
        .map((v) => Number(v.trim()))
        .filter((n) => !Number.isNaN(n));

      if (!this.name.trim() || !this.season.trim()) {
        throw new Error('Name and season are required.');
      }
      if (!pointSystem.length) {
        throw new Error('Point system must include at least one value.');
      }

      const payload = {
        name: this.name.trim(),
        season: this.season.trim(),
        pointSystem,
        useGarage: this.useGarage,
        useWeather: this.useWeather,
        useLegends: this.useLegends,
        useHeavyRain: this.useHeavyRain,
        isActive: this.isActive,
      };

      if (this.editingId) {
        await this.championshipsService.update(this.editingId, payload);
      } else {
        await this.championshipsService.create(payload);
      }
      this.startCreate();
      await this.reload();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Save failed.');
    }
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
