import { Routes } from '@angular/router';
import {
  connectGuard,
  hostGuard,
  sessionGuard,
} from './core/guards/session.guard';
import { ShellComponent } from './shared/components/shell/shell.component';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/landing/landing.component').then(
        (m) => m.LandingComponent
      ),
  },
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
        path: 'cars/:id',
        loadComponent: () =>
          import('./features/cars/car-detail.component').then(
            (m) => m.CarDetailComponent
          ),
      },
      {
        path: 'drivers',
        loadComponent: () =>
          import('./features/drivers/drivers.component').then(
            (m) => m.DriversComponent
          ),
      },
      {
        path: 'drivers/:id',
        loadComponent: () =>
          import('./features/drivers/driver-detail.component').then(
            (m) => m.DriverDetailComponent
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
        path: 'tracks/:id',
        loadComponent: () =>
          import('./features/tracks/track-detail.component').then(
            (m) => m.TrackDetailComponent
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
        path: 'championships/:id',
        loadComponent: () =>
          import('./features/championships/championship-detail.component').then(
            (m) => m.ChampionshipDetailComponent
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
  { path: '**', redirectTo: '' },
];
