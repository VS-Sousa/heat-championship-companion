import { InjectionToken } from '@angular/core';
import { DataProvider } from './data-provider';

export const DATA_PROVIDER = new InjectionToken<DataProvider>('DATA_PROVIDER');
