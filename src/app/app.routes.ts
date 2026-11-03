import { Routes } from '@angular/router';
import {
  connectGuard,
  hostGuard,
  sessionGuard,
} from './core/guards/session.guard';
import { ShellComponent } from './shared/components/shell/shell.component';

export const routes: Routes = [
  {
    path: 'connect',
    canActivate: [connectGuard],
    loadComponent: () =>
      import('./features/connect/connect.component').then(
        (m) => m.ConnectComponent
      ),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [sessionGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
      },
      {
        path: 'cars',
        loadComponent: () =>
          import('./features/cars/cars.component').then((m) => m.CarsComponent),
      },
      {
        path: 'drivers',
        loadComponent: () =>
          import('./features/drivers/drivers.component').then(
            (m) => m.DriversComponent
          ),
      },
      {
        path: 'tracks',
        loadComponent: () =>
          import('./features/tracks/tracks.component').then(
            (m) => m.TracksComponent
          ),
      },
      {
        path: 'championships',
        loadComponent: () =>
          import('./features/championships/championships.component').then(
            (m) => m.ChampionshipsComponent
          ),
      },
      {
        path: 'log-race',
        canActivate: [hostGuard],
        loadComponent: () =>
          import('./features/log-race/log-race.component').then(
            (m) => m.LogRaceComponent
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
