import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Track } from '../../core/models/domain.models';
import { TracksService } from '../../core/services/tracks.service';
import { SessionService } from '../../core/services/session.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-tracks',
  standalone: true,
  imports: [FormsModule, TranslatePipe, RouterLink],
  templateUrl: './tracks.component.html',
  styleUrl: './tracks.component.css',
})
export class TracksComponent implements OnInit {
  private readonly tracksService = inject(TracksService);
  readonly session = inject(SessionService);

  readonly tracks = signal<Track[]>([]);
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);

  editingId: string | null = null;
  name = '';
  country = '';

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

  startCreate(): void {
    this.editingId = null;
    this.name = '';
    this.country = '';
  }

  startEdit(track: Track): void {
    this.editingId = track.id;
    this.name = track.name;
    this.country = track.country;
  }

  async save(): Promise<void> {
    this.error.set(null);
    try {
      const payload = {
        name: this.name.trim(),
        country: this.country.trim(),
      };
      if (!payload.name || !payload.country) {
        throw new Error('Name and country are required.');
      }
      if (this.editingId) {
        await this.tracksService.update(this.editingId, payload);
      } else {
        await this.tracksService.create(payload);
      }
      this.startCreate();
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
