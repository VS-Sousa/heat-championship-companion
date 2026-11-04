import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Driver, StandingRow } from '../../../core/models/domain.models';
import {
  GridAssignment,
  GridEngine,
  GridService,
} from '../../../core/services/grid.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { formatDriverName } from '../../../core/utils/driver-display';
import { inject } from '@angular/core';

@Component({
  selector: 'app-grid-draw',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  template: `
    <div class="space-y-3 rounded-sm border border-heat-border bg-heat-steel/40 p-3">
      <p class="heat-label mb-0">{{ 'grid.title' | t }}</p>
      <div class="grid gap-2 sm:grid-cols-2">
        <select class="heat-input" [(ngModel)]="engine" name="gridEngine">
          <option value="random">{{ 'grid.engineRandom' | t }}</option>
          <option value="reverse_standings">{{ 'grid.engineReverse' | t }}</option>
        </select>
        <button
          type="button"
          class="heat-btn-secondary"
          [disabled]="spinning() || drivers.length < 1"
          (click)="draw()"
        >
          {{ spinning() ? ('grid.drawing' | t) : ('grid.draw' | t) }}
        </button>
      </div>
      @if (preview().length) {
        <ol class="space-y-1 text-sm">
          @for (row of preview(); track row.driverId) {
            <li class="flex justify-between border-b border-heat-border/60 py-1">
              <span class="font-mono text-heat-yellow">P{{ row.gridPosition }}</span>
              <span>{{ labelFor(row.driverId) }}</span>
            </li>
          }
        </ol>
      }
    </div>
  `,
})
export class GridDrawComponent {
  private readonly gridService = inject(GridService);

  @Input({ required: true }) drivers: Driver[] = [];
  @Input() standings: StandingRow[] = [];
  @Output() assigned = new EventEmitter<GridAssignment[]>();

  engine: GridEngine = 'random';
  readonly spinning = signal(false);
  readonly preview = signal<GridAssignment[]>([]);

  labelFor(driverId: string): string {
    const driver = this.drivers.find((d) => d.id === driverId);
    return driver ? formatDriverName(driver) : driverId;
  }

  draw(): void {
    if (this.spinning() || this.drivers.length < 1) return;
    this.spinning.set(true);
    setTimeout(() => {
      const result = this.gridService.assign(
        this.engine,
        this.drivers,
        this.standings
      );
      this.preview.set(result);
      this.assigned.emit(result);
      this.spinning.set(false);
    }, 450);
  }
}
