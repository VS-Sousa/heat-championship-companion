import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { Track } from '../../../core/models/domain.models';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-track-raffle',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="space-y-3">
      <button
        type="button"
        class="heat-btn-secondary w-full"
        [disabled]="spinning() || tracks.length < 1"
        (click)="spin()"
      >
        {{ spinning() ? ('raffle.spinning' | t) : ('raffle.drawTrack' | t) }}
      </button>
      <div
        class="raffle-stage overflow-hidden rounded-sm border border-heat-border bg-heat-steel/70 px-3 py-4 text-center"
      >
        <p class="font-display text-2xl tracking-[0.12em] text-heat-ink">
          {{ displayName() }}
        </p>
        @if (winner()) {
          <p class="mt-1 text-xs uppercase tracking-[0.18em] text-heat-yellow">
            {{ 'raffle.selected' | t }}
          </p>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .raffle-stage {
        min-height: 4.5rem;
        transition: transform 0.08s linear;
      }
    `,
  ],
})
export class TrackRaffleComponent {
  @Input({ required: true }) tracks: Track[] = [];
  @Output() selected = new EventEmitter<string>();

  readonly spinning = signal(false);
  readonly displayName = signal('—');
  readonly winner = signal<Track | null>(null);

  spin(): void {
    if (this.spinning() || this.tracks.length < 1) return;
    this.spinning.set(true);
    this.winner.set(null);

    const pick = this.tracks[Math.floor(Math.random() * this.tracks.length)];
    let ticks = 0;
    const total = 28 + Math.floor(Math.random() * 10);
    const timer = setInterval(() => {
      const flash = this.tracks[ticks % this.tracks.length];
      this.displayName.set(flash.name);
      ticks += 1;
      if (ticks >= total) {
        clearInterval(timer);
        this.displayName.set(pick.name);
        this.winner.set(pick);
        this.spinning.set(false);
        this.selected.emit(pick.id);
      }
    }, 70);
  }
}
