import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ScoringSystem } from '../../core/models/domain.models';
import { ScoringSystemsService } from '../../core/services/scoring-systems.service';
import { SessionService } from '../../core/services/session.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-scoring-systems',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './scoring-systems.component.html',
})
export class ScoringSystemsComponent implements OnInit {
  private readonly service = inject(ScoringSystemsService);
  private readonly i18n = inject(I18nService);
  readonly session = inject(SessionService);

  readonly systems = signal<ScoringSystem[]>([]);
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);
  readonly formOpen = signal(false);

  editingId: string | null = null;
  name = '';
  pointsText = '25,18,15,12,10,8,6,4,2,1';
  bonusFastestLap = 0;
  bonusPole = 0;
  bonusDriverOfDay = 0;

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.systems.set(await this.service.list());
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Failed to load scoring systems.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  resetForm(): void {
    this.editingId = null;
    this.name = '';
    this.pointsText = '25,18,15,12,10,8,6,4,2,1';
    this.bonusFastestLap = 0;
    this.bonusPole = 0;
    this.bonusDriverOfDay = 0;
  }

  startCreate(): void {
    this.resetForm();
    this.formOpen.set(true);
  }

  startEdit(system: ScoringSystem): void {
    this.editingId = system.id;
    this.name = system.name;
    this.pointsText = system.points.join(',');
    this.bonusFastestLap = system.bonusFastestLap;
    this.bonusPole = system.bonusPole;
    this.bonusDriverOfDay = system.bonusDriverOfDay;
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.resetForm();
  }

  async save(): Promise<void> {
    this.error.set(null);
    try {
      const tokens = this.pointsText
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v !== '');
      const points = tokens.map(Number);
      if (!this.name.trim() || !tokens.length) {
        throw new Error(this.i18n.t('scoring.errorRequired'));
      }
      if (points.some((n) => !Number.isInteger(n))) {
        throw new Error(this.i18n.t('scoring.errorPoints'));
      }
      const payload = {
        name: this.name.trim(),
        points,
        bonusFastestLap: Number(this.bonusFastestLap) || 0,
        bonusPole: Number(this.bonusPole) || 0,
        bonusDriverOfDay: Number(this.bonusDriverOfDay) || 0,
      };
      if (this.editingId) {
        await this.service.update(this.editingId, payload);
      } else {
        await this.service.create(payload);
      }
      this.closeForm();
      await this.reload();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Save failed.');
    }
  }

  async remove(system: ScoringSystem): Promise<void> {
    if (system.isBuiltin) return;
    if (!confirm(`Delete scoring system "${system.name}"?`)) return;
    try {
      await this.service.remove(system.id);
      await this.reload();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Delete failed.');
    }
  }
}
