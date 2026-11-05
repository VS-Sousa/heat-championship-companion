import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgClass } from '@angular/common';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

export type DriverKindFilter = 'human' | 'legend' | 'all';

@Component({
  selector: 'app-driver-kind-filter',
  standalone: true,
  imports: [NgClass, TranslatePipe],
  template: `
    <div class="grid grid-cols-3 gap-1.5 sm:gap-2">
      <button
        type="button"
        class="rounded-sm border px-1.5 py-2 text-[11px] uppercase tracking-[0.1em] sm:px-3 sm:text-sm sm:tracking-[0.14em]"
        [ngClass]="
          value === 'human'
            ? 'border-heat-yellow bg-heat-yellow/15 text-heat-yellow'
            : 'border-heat-border text-heat-muted'
        "
        (click)="select('human')"
      >
        {{ 'drivers.filterHuman' | t }}
      </button>
      <button
        type="button"
        class="rounded-sm border px-1.5 py-2 text-[11px] uppercase tracking-[0.1em] sm:px-3 sm:text-sm sm:tracking-[0.14em]"
        [ngClass]="
          value === 'legend'
            ? 'border-heat-yellow bg-heat-yellow/15 text-heat-yellow'
            : 'border-heat-border text-heat-muted'
        "
        (click)="select('legend')"
      >
        {{ 'drivers.filterLegend' | t }}
      </button>
      <button
        type="button"
        class="rounded-sm border px-1.5 py-2 text-[11px] uppercase tracking-[0.1em] sm:px-3 sm:text-sm sm:tracking-[0.14em]"
        [ngClass]="
          value === 'all'
            ? 'border-heat-yellow bg-heat-yellow/15 text-heat-yellow'
            : 'border-heat-border text-heat-muted'
        "
        (click)="select('all')"
      >
        {{ 'drivers.filterAll' | t }}
      </button>
    </div>
  `,
})
export class DriverKindFilterComponent {
  @Input() value: DriverKindFilter = 'human';
  @Output() valueChange = new EventEmitter<DriverKindFilter>();

  select(next: DriverKindFilter): void {
    if (next === this.value) return;
    this.valueChange.emit(next);
  }
}
