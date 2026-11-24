import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Championship, StandingRow } from '../../core/models/domain.models';
import { ChampionshipsService } from '../../core/services/championships.service';
import { SessionService } from '../../core/services/session.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { formatDriverName } from '../../core/utils/driver-display';

@Component({
  selector: 'app-championships',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './championships.component.html',
  styleUrl: './championships.component.css',
})
export class ChampionshipsComponent implements OnInit {
  private readonly championshipsService = inject(ChampionshipsService);
  private readonly router = inject(Router);
  readonly session = inject(SessionService);

  readonly championships = signal<Championship[]>([]);
  readonly standings = signal<StandingRow[]>([]);
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);

  readonly sortedChampionships = computed(() => {
    const list = [...this.championships()];
    return list.sort((a, b) => {
      const aFinished = !a.isActive || !!a.finishedAt;
      const bFinished = !b.isActive || !!b.finishedAt;
      if (aFinished !== bFinished) return aFinished ? 1 : -1;
      return 0;
    });
  });

  viewingId: string | null = null;

  readonly formatDriverName = formatDriverName;

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
    void this.router.navigate(['/championships', 'new']);
  }

  startEdit(c: Championship): void {
    void this.router.navigate(['/championships', c.id, 'edit']);
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
