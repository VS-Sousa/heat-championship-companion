import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Track, TrackCorner } from '../../core/models/domain.models';
import { TracksService } from '../../core/services/tracks.service';
import { SessionService } from '../../core/services/session.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';
import { SearchableSelectComponent } from '../../shared/components/searchable-select/searchable-select.component';
import { countryLabel, countryOptions, resolveCountryCode } from '../../core/data/countries';

@Component({
  selector: 'app-tracks',
  standalone: true,
  imports: [FormsModule, TranslatePipe, RouterLink, SearchableSelectComponent],
  templateUrl: './tracks.component.html',
  styleUrl: './tracks.component.css',
})
export class TracksComponent implements OnInit {
  private readonly tracksService = inject(TracksService);
  private readonly i18n = inject(I18nService);
  readonly session = inject(SessionService);

  readonly countryOptions = computed(() => countryOptions(this.i18n.lang()));

  readonly tracks = signal<Track[]>([]);
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);
  readonly formOpen = signal(false);

  editingId: string | null = null;
  name = '';
  country = '';
  lengthSpaces: number | null = null;
  laps: number | null = null;
  corners: TrackCorner[] = [];

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.tracks.set(await this.tracksService.list());
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Failed to load tracks.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  countryText(value: string): string {
    return countryLabel(value, this.i18n.lang());
  }

  addCorner(): void {
    this.corners = [
      ...this.corners,
      { order: this.corners.length + 1, name: '', maxSpeed: 0 },
    ];
  }

  removeCorner(index: number): void {
    this.corners = this.corners.filter((_, i) => i !== index);
  }

  resetForm(): void {
    this.editingId = null;
    this.name = '';
    this.country = '';
    this.lengthSpaces = null;
    this.laps = null;
    this.corners = [];
  }

  startCreate(): void {
    this.resetForm();
    this.formOpen.set(true);
  }

  startEdit(track: Track): void {
    this.editingId = track.id;
    this.name = track.name;
    this.country = resolveCountryCode(track.country) || track.country;
    this.lengthSpaces = track.lengthSpaces ?? null;
    this.laps = track.laps ?? null;
    this.corners = (track.corners ?? []).map((c) => ({ ...c }));
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.resetForm();
  }

  async save(): Promise<void> {
    this.error.set(null);
    try {
      const payload = {
        name: this.name.trim(),
        country: this.country.trim(),
        lengthSpaces: this.lengthSpaces ? Number(this.lengthSpaces) : undefined,
        laps: this.laps ? Number(this.laps) : undefined,
        corners: this.corners
          .map((c, i) => ({
            order: Number(c.order) || i + 1,
            name: (c.name ?? '').trim(),
            maxSpeed: Number(c.maxSpeed) || 0,
          }))
          .sort((a, b) => a.order - b.order),
      };
      if (!payload.name || !payload.country) {
        throw new Error('Name and country are required.');
      }
      if (this.editingId) {
        await this.tracksService.update(this.editingId, payload);
      } else {
        await this.tracksService.create(payload);
      }
      this.closeForm();
      await this.reload();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Save failed.');
    }
  }

  async remove(track: Track): Promise<void> {
    if (!confirm(`Delete track "${track.name}"?`)) return;
    try {
      await this.tracksService.remove(track.id);
      await this.reload();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Delete failed.');
    }
  }
}
