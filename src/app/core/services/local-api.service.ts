import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { setStorageModeOverride } from '../data/resolve-storage-mode';
import { SessionService } from './session.service';

@Injectable({ providedIn: 'root' })
export class LocalApiService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  async probe(apiBaseUrl: string): Promise<void> {
    const base = apiBaseUrl.replace(/\/$/, '');
    try {
      await firstValueFrom(
        this.http.get<{ ok: boolean }>(`${base}/api/health`)
      );
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 0) {
        throw new Error(
          'Could not reach the local API. Start it with docker compose up.'
        );
      }
      throw new Error('Local API health check failed.');
    }
  }

  async connectAsGuest(apiBaseUrl = environment.apiBaseUrl): Promise<void> {
    const base = apiBaseUrl.replace(/\/$/, '');
    await this.probe(base);
    const auth = await firstValueFrom(
      this.http.post<{ role: string; token: string }>(
        `${base}/api/auth/guest`,
        {}
      )
    );
    setStorageModeOverride('local');
    this.session.saveLocal(base, auth.token, null);
  }

  async connectAsHost(
    username: string,
    password: string,
    apiBaseUrl = environment.apiBaseUrl
  ): Promise<void> {
    const base = apiBaseUrl.replace(/\/$/, '');
    await this.probe(base);
    let auth: { role: 'host' | 'admin'; username: string; token: string };
    try {
      auth = await firstValueFrom(
        this.http.post<{
          role: 'host' | 'admin';
          username: string;
          token: string;
        }>(`${base}/api/auth/host`, { username, password })
      );
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        throw new Error('Invalid credentials.');
      }
      throw new Error(
        err instanceof Error ? err.message : 'Local host authentication failed.'
      );
    }
    setStorageModeOverride('local');
    this.session.saveLocal(base, auth.token, {
      id: 'local-host',
      username: auth.username,
      role: auth.role === 'admin' ? 'admin' : 'host',
    });
  }
}
