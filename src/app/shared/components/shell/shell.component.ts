import { Component, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SessionService } from '../../../core/services/session.service';
import { SupabaseService } from '../../../core/services/supabase.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgClass],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent {
  readonly session = inject(SessionService);
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  menuOpen = false;

  readonly links = [
    { path: '/dashboard', label: 'Dashboard', hostOnly: false },
    { path: '/championships', label: 'Championships', hostOnly: false },
    { path: '/drivers', label: 'Drivers', hostOnly: false },
    { path: '/cars', label: 'Cars', hostOnly: false },
    { path: '/tracks', label: 'Tracks', hostOnly: false },
    { path: '/log-race', label: 'Log Race', hostOnly: true },
  ];

  visibleLinks() {
    return this.links.filter((link) => !link.hostOnly || this.session.isHost());
  }

  async disconnect(): Promise<void> {
    await this.supabase.disconnect();
    await this.router.navigateByUrl('/connect');
  }
}
