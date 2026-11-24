export function pointsForPosition(
  pointSystem: number[],
  position: number
): number {
  return pointSystem[position - 1] ?? 0;
}

export function validateResults(
  results: {
    driverId: string;
    carId: string;
    gridPosition: number;
    position: number;
  }[]
): void {
  if (!results.length) {
    throw new Error('Add at least one driver result.');
  }

  const drivers = new Set<string>();
  const cars = new Set<string>();
  const grids = new Set<number>();
  const positions = new Set<number>();

  for (const result of results) {
    if (drivers.has(result.driverId)) {
      throw new Error('Each driver can only appear once in a race.');
    }
    if (cars.has(result.carId)) {
      throw new Error('Each car can only appear once in a race.');
    }
    if (grids.has(result.gridPosition)) {
      throw new Error('Grid positions must be unique.');
    }
    if (positions.has(result.position)) {
      throw new Error('Finishing positions must be unique.');
    }
    drivers.add(result.driverId);
    cars.add(result.carId);
    grids.add(result.gridPosition);
    positions.add(result.position);
  }
}
