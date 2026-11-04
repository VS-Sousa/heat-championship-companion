import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Car, Driver } from '../../core/models/domain.models';
import { CarsService } from '../../core/services/cars.service';
import { DriversService } from '../../core/services/drivers.service';
import { SessionService } from '../../core/services/session.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { formatDriverName } from '../../core/utils/driver-display';
import {
  DriverKindFilter,
  DriverKindFilterComponent,
} from '../../shared/components/driver-kind-filter/driver-kind-filter.component';

@Component({
  selector: 'app-drivers',
  standalone: true,
  imports: [
    FormsModule,
    DecimalPipe,
    TranslatePipe,
    RouterLink,
    DriverKindFilterComponent,
  ],
  templateUrl: './drivers.component.html',
  styleUrl: './drivers.component.css',
})
export class DriversComponent implements OnInit {
  private readonly driversService = inject(DriversService);
  private readonly carsService = inject(CarsService);
  readonly session = inject(SessionService);

  readonly drivers = signal<Driver[]>([]);
  readonly cars = signal<Car[]>([]);
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);
  readonly formOpen = signal(false);
  readonly listFilter = signal<DriverKindFilter>('human');

  readonly filteredDrivers = computed(() => {
    const filter = this.listFilter();
    const all = this.drivers();
    if (filter === 'human') return all.filter((d) => !d.isLegend);
    if (filter === 'legend') return all.filter((d) => d.isLegend);
    return all;
  });

  editingId: string | null = null;
  name = '';
  nickname = '';
  abbreviation = '';
  number = 1;
  isLegend = false;
  fixedCarId = '';
  favoriteCarId = '';

  readonly formatDriverName = formatDriverName;

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [drivers, cars] = await Promise.all([
        this.driversService.list(),
        this.carsService.list(),
      ]);
      this.drivers.set(drivers);
      this.cars.set(cars);
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Failed to load drivers.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  carName(id?: string): string {
    if (!id) return '—';
    return this.cars().find((c) => c.id === id)?.name ?? 'Missing car';
  }

  carColor(id?: string): string {
    if (!id) return 'transparent';
    return this.cars().find((c) => c.id === id)?.colorHex ?? 'transparent';
  }

  resetForm(): void {
    this.editingId = null;
    this.name = '';
    this.nickname = '';
    this.abbreviation = '';
    this.number = 1;
    this.isLegend = false;
    this.fixedCarId = '';
    this.favoriteCarId = '';
  }

  startCreate(): void {
    this.resetForm();
    this.formOpen.set(true);
  }

  startEdit(driver: Driver): void {
    this.editingId = driver.id;
    this.name = driver.name;
    this.nickname = driver.nickname ?? '';
    this.abbreviation = driver.abbreviation;
    this.number = driver.number;
    this.isLegend = driver.isLegend;
    this.fixedCarId = driver.fixedCarId ?? '';
    this.favoriteCarId = driver.favoriteCarId ?? '';
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.resetForm();
  }

  async save(): Promise<void> {
    this.error.set(null);
    try {
      const abbr = this.abbreviation.trim().toUpperCase();
      if (!this.name.trim()) throw new Error('Driver name is required.');
      if (!/^[A-Z]{3}$/.test(abbr)) {
        throw new Error('Abbreviation must be exactly 3 letters.');
      }
      if (this.number < 0 || this.number > 99) {
        throw new Error('Number must be between 0 and 99.');
      }
      if (this.isLegend && !this.fixedCarId) {
        throw new Error('Legend drivers require a fixed car.');
      }

      const favoriteCarId =
        this.isLegend && this.fixedCarId
          ? this.fixedCarId
          : this.favoriteCarId || undefined;

      const payload = {
        name: this.name.trim(),
        nickname: this.nickname.trim() || undefined,
        abbreviation: abbr,
        number: this.number,
        isLegend: this.isLegend,
        fixedCarId: this.isLegend ? this.fixedCarId : undefined,
        favoriteCarId,
      };

      if (this.editingId) {
        await this.driversService.update(this.editingId, payload);
      } else {
        await this.driversService.create(payload);
      }
      this.closeForm();
      await this.reload();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Save failed.');
    }
  }

  async remove(driver: Driver): Promise<void> {
    if (!confirm(`Delete driver "${formatDriverName(driver)}"?`)) return;
    try {
      await this.driversService.remove(driver.id);
      await this.reload();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Delete failed.');
    }
  }
}
