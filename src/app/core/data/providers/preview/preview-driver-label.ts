import { ChampionshipEntry, Driver } from '../../../models/domain.models';

/** Fallback 3-letter code when a driver has no championship entry. */
export function fallbackAbbreviation(name: string): string {
  const letters = name.replace(/[^A-Za-z]/g, '').toUpperCase();
  return (letters.slice(0, 3) || '???').padEnd(3, '?');
}

export interface DriverLabel {
  abbreviation: string;
  number: number;
}

/**
 * Resolve display abbreviation/number for a driver: entry in the given
 * championship if present, else most recent entry, else a name-derived fallback.
 */
export function resolveDriverLabel(
  driver: Pick<Driver, 'id' | 'name'>,
  entries: ChampionshipEntry[],
  championshipId?: string
): DriverLabel {
  const owned = entries.filter((entry) => entry.driverId === driver.id);
  const entry =
    (championshipId
      ? owned.find((item) => item.championshipId === championshipId)
      : undefined) ?? owned[owned.length - 1];
  return entry
    ? { abbreviation: entry.abbreviation, number: entry.number }
    : { abbreviation: fallbackAbbreviation(driver.name), number: 0 };
}
