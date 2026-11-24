import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  BreakdownStatRow,
  Car,
  ResultHistoryRow,
  TitleWin,
} from '../../core/models/domain.models';
import { CarsService } from '../../core/services/cars.service';
import { RacesService } from '../../core/services/races.service';
import { ChampionshipsService } from '../../core/services/championships.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';

@Component({
  selector: 'app-car-detail',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './car-detail.component.html',
})
export class CarDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly carsService = inject(CarsService);
  private readonly racesService = inject(RacesService);
  private readonly championshipsService = inject(ChampionshipsService);
  private readonly i18n = inject(I18nService);

  readonly car = signal<Car | null>(null);
  readonly history = signal<ResultHistoryRow[]>([]);
  readonly byDriver = signal<BreakdownStatRow[]>([]);
  readonly byTrack = signal<BreakdownStatRow[]>([]);
  readonly titles = signal<TitleWin[]>([]);
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);
  readonly copied = signal(false);
  private copiedTimer?: ReturnType<typeof setTimeout>;

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.loading.set(true);
    try {
      const car = await this.carsService.getById(id);
      if (!car) throw new Error('Car not found.');
      const [history, byDriver, byTrack, titles] = await Promise.all([
        this.racesService.getCarResultHistory(id),
        this.racesService.getCarBreakdownByDriver(id),
        this.racesService.getCarBreakdownByTrack(id),
        this.championshipsService.getCarTitles(id),
      ]);
      this.car.set(car);
      this.history.set(history);
      this.byDriver.set(byDriver);
      this.byTrack.set(byTrack);
      this.titles.set(titles);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load.');
    } finally {
      this.loading.set(false);
    }
  }

  async copyColor(): Promise<void> {
    const hex = this.car()?.colorHex;
    if (!hex) return;
    try {
      await navigator.clipboard.writeText(hex);
      this.copied.set(true);
      clearTimeout(this.copiedTimer);
      this.copiedTimer = setTimeout(() => this.copied.set(false), 1500);
    } catch {
      this.error.set(this.i18n.t('cars.copyFailed'));
    }
  }
}
