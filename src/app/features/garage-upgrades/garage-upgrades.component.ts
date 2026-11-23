import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  GarageUpgrade,
  GarageUpgradeCategory,
} from '../../core/models/domain.models';
import { GarageUpgradesService } from '../../core/services/garage-upgrades.service';
import { SessionService } from '../../core/services/session.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';

export const GARAGE_CATEGORIES: GarageUpgradeCategory[] = [
  'engine',
  'suspension',
  'brakes',
  'tires',
  'cooling',
  'other',
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

  readonly categories = GARAGE_CATEGORIES;
  readonly upgrades = signal<GarageUpgrade[]>([]);
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);
  readonly formOpen = signal(false);

  editingId: string | null = null;
  name = '';
  category: GarageUpgradeCategory = 'engine';
  heatCost = 0;
  effect = '';

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
    this.category = 'engine';
    this.heatCost = 0;
    this.effect = '';
  }

  startCreate(): void {
    this.resetForm();
    this.formOpen.set(true);
  }

  startEdit(upgrade: GarageUpgrade): void {
    this.editingId = upgrade.id;
    this.name = upgrade.name;
    this.category = upgrade.category;
    this.heatCost = upgrade.heatCost;
    this.effect = upgrade.effect;
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
        category: this.category,
        heatCost: Number(this.heatCost) || 0,
        effect: this.effect.trim(),
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
