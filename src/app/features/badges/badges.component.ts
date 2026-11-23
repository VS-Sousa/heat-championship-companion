import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  BadgeAward,
  BadgeDefinition,
  Driver,
} from '../../core/models/domain.models';
import { BadgesService } from '../../core/services/badges.service';
import { DriversService } from '../../core/services/drivers.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { formatDriverName } from '../../core/utils/driver-display';

@Component({
  selector: 'app-badges',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './badges.component.html',
})
export class BadgesComponent implements OnInit {
  private readonly badgesService = inject(BadgesService);
  private readonly driversService = inject(DriversService);

  readonly definitions = signal<BadgeDefinition[]>([]);
  readonly awards = signal<BadgeAward[]>([]);
  readonly drivers = signal<Driver[]>([]);
  readonly error = signal<string | null>(null);
  readonly loading = signal(true);

  async ngOnInit(): Promise<void> {
    try {
      const [definitions, awards, drivers] = await Promise.all([
        this.badgesService.listDefinitions(),
        this.badgesService.listAwards(),
        this.driversService.list(),
      ]);
      this.definitions.set(definitions);
      this.awards.set(
        [...awards].sort((a, b) => b.awardedAt.localeCompare(a.awardedAt))
      );
      this.drivers.set(drivers);
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Failed to load badges.'
      );
    } finally {
      this.loading.set(false);
    }
  }

  driverName(driverId: string): string {
    const driver = this.drivers().find((d) => d.id === driverId);
    return driver ? formatDriverName(driver) : driverId;
  }

  badgeName(badgeId: string): string {
    return this.definitions().find((d) => d.id === badgeId)?.name ?? badgeId;
  }

  awardCount(badgeId: string): number {
    return this.awards().filter((a) => a.badgeId === badgeId).length;
  }
}
