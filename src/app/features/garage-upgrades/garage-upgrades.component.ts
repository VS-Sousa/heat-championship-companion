import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  GarageUpgrade,
  GarageUpgradeSet,
} from '../../core/models/domain.models';
import { GarageUpgradesService } from '../../core/services/garage-upgrades.service';
import { SessionService } from '../../core/services/session.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';

export const GARAGE_SETS: GarageUpgradeSet[] = [
  'basegame',
  'heavy_rain',
  'tunnel_vision',
  'rocky_roads',
  'homebrew',
];

@Component({
  selector: 'app-garage-upgrades',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './garage-upgrades.component.html',
})
export class GarageUpgradesComponent implements OnInit {
  private readonly service = inject(GarageUpgradesService);
  private readonly i18n = inject(I18nService);
  readonly session = inject(SessionService);

  readonly sets = GARAGE_SETS;
  readonly upgrades = signal<GarageUpgrade[]>([]);
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);
  readonly formOpen = signal(false);

  editingId: string | null = null;
  name = '';
  description = '';
  set: GarageUpgradeSet = 'basegame';

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.upgrades.set(await this.service.list());
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Failed to load upgrades.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  resetForm(): void {
    this.editingId = null;
    this.name = '';
    this.description = '';
    this.set = 'basegame';
  }

  startCreate(): void {
    this.resetForm();
    this.formOpen.set(true);
  }

  startEdit(upgrade: GarageUpgrade): void {
    this.editingId = upgrade.id;
    this.name = upgrade.name;
    this.description = upgrade.description;
    this.set = upgrade.set;
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
        description: this.description.trim(),
        set: this.set,
      };
      if (!payload.name) {
        throw new Error(this.i18n.t('garage.errorRequired'));
      }
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

  async remove(upgrade: GarageUpgrade): Promise<void> {
    if (!confirm(`Delete upgrade "${upgrade.name}"?`)) return;
    try {
      await this.service.remove(upgrade.id);
      await this.reload();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Delete failed.');
    }
  }
}
