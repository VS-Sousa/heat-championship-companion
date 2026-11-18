import { PreviewDb } from './preview-store';

const CAR_RED = '11111111-1111-4111-8111-111111111101';
const CAR_BLUE = '11111111-1111-4111-8111-111111111102';
const CAR_GREEN = '11111111-1111-4111-8111-111111111103';
const CAR_YELLOW = '11111111-1111-4111-8111-111111111104';

const D_ALO = '22222222-2222-4222-8222-222222222201';
const D_SEN = '22222222-2222-4222-8222-222222222202';
const D_HAM = '22222222-2222-4222-8222-222222222203';
const D_VER = '22222222-2222-4222-8222-222222222204';

const T_USA = '33333333-3333-4333-8333-333333333301';
const T_GBR = '33333333-3333-4333-8333-333333333302';
const T_ITA = '33333333-3333-4333-8333-333333333303';

const CHAMP = '44444444-4444-4444-8444-444444444401';
const SERIES = '55555555-5555-4555-8555-555555555501';

const R1 = '66666666-6666-4666-8666-666666666601';
const R2 = '66666666-6666-4666-8666-666666666602';
const R3 = '66666666-6666-4666-8666-666666666603';

export function createPreviewSeed(): PreviewDb {
  return {
    cars: [
      {
        id: CAR_RED,
        name: 'Red Arrow',
        colorKey: '#e1221c',
        colorHex: '#E1221C',
      },
      {
        id: CAR_BLUE,
        name: 'Blue Bolt',
        colorKey: '#1c4fe1',
        colorHex: '#1C4FE1',
      },
      {
        id: CAR_GREEN,
        name: 'Green Machine',
        colorKey: '#1ca84a',
        colorHex: '#1CA84A',
      },
      {
        id: CAR_YELLOW,
        name: 'Yellow Lightning',
        colorKey: '#e1b21c',
        colorHex: '#E1B21C',
      },
    ],
    drivers: [
      {
        id: D_ALO,
        name: 'Ayrton',
        nickname: 'Lightning',
        abbreviation: 'ALO',
        number: 1,
        isLegend: false,
        favoriteCarId: CAR_RED,
      },
      {
        id: D_SEN,
        name: 'Senna',
        abbreviation: 'SEN',
        number: 12,
        isLegend: true,
        fixedCarId: CAR_YELLOW,
      },
      {
        id: D_HAM,
        name: 'Hamilton',
        abbreviation: 'HAM',
        number: 44,
        isLegend: false,
        favoriteCarId: CAR_BLUE,
      },
      {
        id: D_VER,
        name: 'Verstappen',
        abbreviation: 'VER',
        number: 33,
        isLegend: false,
        favoriteCarId: CAR_GREEN,
      },
    ],
    tracks: [
      { id: T_USA, name: 'USA', country: 'United States' },
      { id: T_GBR, name: 'Great Britain', country: 'United Kingdom' },
      { id: T_ITA, name: 'Italy', country: 'Italy' },
    ],
    championships: [
      {
        id: CHAMP,
        name: 'Demo Championship',
        season: '2026',
        seriesId: SERIES,
        editionNumber: 1,
        pointSystem: [9, 6, 4, 3, 2, 1],
        useGarage: true,
        useEvents: false,
        usePress: false,
        useSponsorship: false,
        isActive: true,
      },
    ],
    races: [
      {
        id: R1,
        championshipId: CHAMP,
        trackId: T_USA,
        roundNumber: 1,
        raceType: 'championship',
        status: 'completed',
        weatherCondition: 'clear',
        racedAt: '2026-03-01T18:00:00.000Z',
        createdAt: '2026-03-01T18:00:00.000Z',
      },
      {
        id: R2,
        championshipId: CHAMP,
        trackId: T_GBR,
        roundNumber: 2,
        raceType: 'championship',
        status: 'completed',
        weatherCondition: 'cloudy',
        racedAt: '2026-03-15T18:00:00.000Z',
        createdAt: '2026-03-15T18:00:00.000Z',
      },
      {
        id: R3,
        championshipId: CHAMP,
        trackId: T_ITA,
        roundNumber: 3,
        raceType: 'championship',
        status: 'planned',
        createdAt: '2026-01-01T12:00:00.000Z',
      },
    ],
    results: [
      {
        id: '77777777-7777-4777-8777-777777777701',
        raceId: R1,
        driverId: D_ALO,
        carId: CAR_RED,
        gridPosition: 2,
        position: 1,
        pointsAwarded: 9,
        dnf: false,
      },
      {
        id: '77777777-7777-4777-8777-777777777702',
        raceId: R1,
        driverId: D_HAM,
        carId: CAR_BLUE,
        gridPosition: 1,
        position: 2,
        pointsAwarded: 6,
        dnf: false,
      },
      {
        id: '77777777-7777-4777-8777-777777777703',
        raceId: R1,
        driverId: D_VER,
        carId: CAR_GREEN,
        gridPosition: 3,
        position: 3,
        pointsAwarded: 4,
        dnf: false,
      },
      {
        id: '77777777-7777-4777-8777-777777777704',
        raceId: R1,
        driverId: D_SEN,
        carId: CAR_YELLOW,
        gridPosition: 4,
        position: 4,
        pointsAwarded: 3,
        dnf: false,
      },
      {
        id: '77777777-7777-4777-8777-777777777705',
        raceId: R2,
        driverId: D_HAM,
        carId: CAR_BLUE,
        gridPosition: 2,
        position: 1,
        pointsAwarded: 9,
        dnf: false,
      },
      {
        id: '77777777-7777-4777-8777-777777777706',
        raceId: R2,
        driverId: D_ALO,
        carId: CAR_RED,
        gridPosition: 1,
        position: 2,
        pointsAwarded: 6,
        dnf: false,
      },
      {
        id: '77777777-7777-4777-8777-777777777707',
        raceId: R2,
        driverId: D_SEN,
        carId: CAR_YELLOW,
        gridPosition: 3,
        position: 3,
        pointsAwarded: 4,
        dnf: false,
      },
      {
        id: '77777777-7777-4777-8777-777777777708',
        raceId: R2,
        driverId: D_VER,
        carId: CAR_GREEN,
        gridPosition: 4,
        position: 4,
        pointsAwarded: 0,
        dnf: true,
      },
    ],
  };
}
