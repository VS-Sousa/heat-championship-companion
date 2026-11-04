import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Track } from '../../../core/models/domain.models';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TrackRaffleComponent } from './track-raffle.component';

@Component({
  selector: 'app-track-raffle-modal',
  standalone: true,
  imports: [TranslatePipe, TrackRaffleComponent],
  template: `
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      role="dialog"
      aria-modal="true"
      (click)="closed.emit()"
    >
      <div
        class="heat-panel w-full max-w-md space-y-4 p-5 shadow-xl"
        (click)="$event.stopPropagation()"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="heat-subtitle">{{ 'raffle.drawTrack' | t }}</p>
            <h2 class="font-display text-2xl tracking-wider text-heat-ink">
              {{ 'raffle.modalTitle' | t }}
            </h2>
          </div>
          <button
            type="button"
            class="heat-btn-ghost text-sm"
            (click)="closed.emit()"
          >
            {{ 'common.close' | t }}
          </button>
        </div>
        <app-track-raffle
          [tracks]="tracks"
          (selected)="onSelected($event)"
        />
      </div>
    </div>
  `,
})
export class TrackRaffleModalComponent {
  @Input({ required: true }) tracks: Track[] = [];
  @Output() selected = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();

  onSelected(trackId: string): void {
    this.selected.emit(trackId);
    this.closed.emit();
  }
}
