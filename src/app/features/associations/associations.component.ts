import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Association, Driver } from '../../core/models/domain.models';
import { AssociationsService } from '../../core/services/associations.service';
import { DriversService } from '../../core/services/drivers.service';
import { SessionService } from '../../core/services/session.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';
import { formatDriverName } from '../../core/utils/driver-display';

@Component({
  selector: 'app-associations',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './associations.component.html',
})
export class AssociationsComponent implements OnInit {
  private readonly associationsService = inject(AssociationsService);
  private readonly driversService = inject(DriversService);
  private readonly i18n = inject(I18nService);
  readonly session = inject(SessionService);

  readonly associations = signal<Association[]>([]);
  readonly drivers = signal<Driver[]>([]);
  readonly memberCounts = signal<Record<string, number>>({});
  readonly selectedMemberIds = signal<string[]>([]);
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);
  readonly formOpen = signal(false);

  readonly humanDrivers = computed(() => this.drivers().filter((d) => !d.isLegend));

  readonly formatDriverName = formatDriverName;

  editingId: string | null = null;
  name = '';

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [associations, drivers] = await Promise.all([
        this.associationsService.list(),
        this.driversService.list(),
      ]);
      this.associations.set(associations);
      this.drivers.set(drivers);
      const counts: Record<string, number> = {};
      await Promise.all(
        associations.map(async (a) => {
          counts[a.id] = (await this.associationsService.listMemberIds(a.id)).length;
        })
      );
      for (const a of associations) counts[a.id] ??= 0;
      this.memberCounts.set(counts);
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Failed to load associations.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  resetForm(): void {
    this.editingId = null;
    this.name = '';
    this.selectedMemberIds.set([]);
  }

  startCreate(): void {
    this.resetForm();
    this.formOpen.set(true);
  }

  async startEdit(association: Association): Promise<void> {
    this.editingId = association.id;
    this.name = association.name;
    try {
      this.selectedMemberIds.set(
        await this.associationsService.listMemberIds(association.id)
      );
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Failed to load members.'
      );
      this.selectedMemberIds.set([]);
    }
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.resetForm();
  }

  isMember(driverId: string): boolean {
    return this.selectedMemberIds().includes(driverId);
  }

  toggleMember(driverId: string, checked: boolean): void {
    this.selectedMemberIds.update((ids) =>
      checked
        ? ids.includes(driverId)
          ? ids
          : [...ids, driverId]
        : ids.filter((id) => id !== driverId)
    );
  }

  async save(): Promise<void> {
    this.error.set(null);
    try {
      const payload = {
        name: this.name.trim(),
      };
      if (!payload.name) {
        throw new Error(this.i18n.t('associations.errorRequired'));
      }
      const saved = this.editingId
        ? await this.associationsService.update(this.editingId, payload)
        : await this.associationsService.create(payload);
      await this.associationsService.setMembers(saved.id, this.selectedMemberIds());
      this.closeForm();
      await this.reload();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Save failed.');
    }
  }

  async remove(association: Association): Promise<void> {
    if (!confirm(`Delete association "${association.name}"?`)) return;
    try {
      await this.associationsService.remove(association.id);
      await this.reload();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Delete failed.');
    }
  }
}
