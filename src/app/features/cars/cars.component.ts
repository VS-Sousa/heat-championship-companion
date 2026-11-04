import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Car } from '../../core/models/domain.models';
import { CarsService } from '../../core/services/cars.service';
import { SessionService } from '../../core/services/session.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

@Component({
  selector: 'app-cars',
  standalone: true,
  imports: [FormsModule, TranslatePipe, RouterLink],
  templateUrl: './cars.component.html',
  styleUrl: './cars.component.css',
})
export class CarsComponent implements OnInit {
  private readonly carsService = inject(CarsService);
  readonly session = inject(SessionService);

  readonly cars = signal<Car[]>([]);
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);

  editingId: string | null = null;
  name = '';
  colorHex = '#E1221C';

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.cars.set(await this.carsService.list());
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load cars.');
    } finally {
      this.loading.set(false);
    }
  }

  startCreate(): void {
    this.editingId = null;
    this.name = '';
    this.colorHex = '#E1221C';
  }

  startEdit(car: Car): void {
    this.editingId = car.id;
    this.name = car.name;
    this.colorHex = car.colorHex;
  }

  async save(): Promise<void> {
    this.error.set(null);
    try {
      const payload = {
        name: this.name.trim(),
        colorHex: this.colorHex,
        colorKey: this.colorHex.toLowerCase(),
      };
      if (!payload.name) throw new Error('Car name is required.');
      if (this.editingId) {
        await this.carsService.update(this.editingId, payload);
      } else {
        await this.carsService.create(payload);
      }
      this.startCreate();
      await this.reload();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Save failed.');
    }
  }

  async remove(car: Car): Promise<void> {
    if (!confirm(`Delete car "${car.name}"?`)) return;
    try {
      await this.carsService.remove(car.id);
      await this.reload();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Delete failed.');
    }
  }
}
