import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  BreakdownStatRow,
  Driver,
  HeadToHeadRow,
  ResultHistoryRow,
  TitleWin,
} from '../../core/models/domain.models';
import { DriversService } from '../../core/services/drivers.service';
import { RacesService } from '../../core/services/races.service';
import { ChampionshipsService } from '../../core/services/championships.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { formatDriverName } from '../../core/utils/driver-display';

@Component({
  selector: 'app-driver-detail',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './driver-detail.component.html',
})
export class DriverDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly driversService = inject(DriversService);
  private readonly racesService = inject(RacesService);
  private readonly championshipsService = inject(ChampionshipsService);

  readonly driver = signal<Driver | null>(null);
  readonly history = signal<ResultHistoryRow[]>([]);
  readonly byCar = signal<BreakdownStatRow[]>([]);
  readonly byTrack = signal<BreakdownStatRow[]>([]);
  readonly titles = signal<TitleWin[]>([]);
  readonly duels = signal<HeadToHeadRow[]>([]);
  readonly best = signal<{ position: number; racedAt?: string; trackName?: string } | null>(null);
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);

  readonly formatDriverName = formatDriverName;

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.loading.set(true);
    try {
      const driver = await this.driversService.getById(id);
      if (!driver) throw new Error('Driver not found.');
      const [history, byCar, byTrack, titles, duels, best] = await Promise.all([
        this.racesService.getDriverResultHistory(id),
        this.racesService.getDriverBreakdownByCar(id),
        this.racesService.getDriverBreakdownByTrack(id),
        this.championshipsService.getDriverTitles(id),
        this.racesService.getDriverHeadToHead(id),
        this.racesService.getDriverBestFinish(id),
      ]);
      this.driver.set(driver);
      this.history.set(history);
      this.byCar.set(byCar);
      this.byTrack.set(byTrack);
      this.titles.set(titles);
      this.duels.set(duels);
      this.best.set(best);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load.');
    } finally {
      this.loading.set(false);
    }
  }
}
