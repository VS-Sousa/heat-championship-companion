import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
} from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../../../services/session.service';
import { environment } from '../../../../../environments/environment';

export class LocalApiClient {
  constructor(
    private readonly http: HttpClient,
    private readonly session: SessionService
  ) {}

  baseUrl(): string {
    const fromSession = this.session.session()?.localAuth?.apiBaseUrl?.trim();
    return (fromSession || environment.apiBaseUrl).replace(/\/$/, '');
  }

  private headers(): HttpHeaders {
    const token = this.session.session()?.localAuth?.token;
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  private url(path: string): string {
    return `${this.baseUrl()}/api${path.startsWith('/') ? path : `/${path}`}`;
  }

  private async unwrap<T>(promise: Promise<T>): Promise<T> {
    try {
      return await promise;
    } catch (err) {
      throw new Error(this.messageFromError(err));
    }
  }

  private messageFromError(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as { error?: string } | string | null;
      if (typeof body === 'string' && body.trim()) return body;
      if (body && typeof body === 'object' && body.error) return body.error;
      if (err.status === 0) {
        return 'Could not reach the local API. Is docker compose / server running?';
      }
      return err.message || `HTTP ${err.status}`;
    }
    if (err instanceof Error) return err.message;
    return 'Local API request failed.';
  }

  get<T>(path: string): Promise<T> {
    return this.unwrap(
      firstValueFrom(this.http.get<T>(this.url(path), { headers: this.headers() }))
    );
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.unwrap(
      firstValueFrom(
        this.http.post<T>(this.url(path), body ?? {}, { headers: this.headers() })
      )
    );
  }

  put<T>(path: string, body: unknown): Promise<T> {
    return this.unwrap(
      firstValueFrom(
        this.http.put<T>(this.url(path), body, { headers: this.headers() })
      )
    );
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return this.unwrap(
      firstValueFrom(
        this.http.patch<T>(this.url(path), body, { headers: this.headers() })
      )
    );
  }

  async delete(path: string): Promise<void> {
    await this.unwrap(
      firstValueFrom(
        this.http.delete(this.url(path), {
          headers: this.headers(),
          observe: 'response',
        })
      )
    );
  }

  async getNullable<T>(path: string): Promise<T | null> {
    try {
      return await this.get<T>(path);
    } catch (err) {
      if (err instanceof Error && /not found/i.test(err.message)) {
        return null;
      }
      if (err instanceof HttpErrorResponse && err.status === 404) {
        return null;
      }
      // get() already unwraps HttpErrorResponse into Error
      if (err instanceof Error && err.message.includes('404')) {
        return null;
      }
      throw err;
    }
  }
}
