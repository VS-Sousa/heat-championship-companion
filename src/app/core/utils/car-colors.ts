export interface CarColorOption {
  key: string;
  hex: string;
  labelKey: string;
}

/** Named racing colors (Heat-style). Keys are stored on cars.color_key. */
export const CAR_COLORS: CarColorOption[] = [
  { key: 'red', hex: '#E1221C', labelKey: 'carColor.red' },
  { key: 'orange', hex: '#E36A12', labelKey: 'carColor.orange' },
  { key: 'yellow', hex: '#F5C518', labelKey: 'carColor.yellow' },
  { key: 'green', hex: '#1F8A4C', labelKey: 'carColor.green' },
  { key: 'blue', hex: '#1E5EFF', labelKey: 'carColor.blue' },
  { key: 'purple', hex: '#7B2CBF', labelKey: 'carColor.purple' },
  { key: 'black', hex: '#1A1A1A', labelKey: 'carColor.black' },
  { key: 'white', hex: '#F4F4F4', labelKey: 'carColor.white' },
  { key: 'pink', hex: '#E85D8E', labelKey: 'carColor.pink' },
  { key: 'cyan', hex: '#00B7C7', labelKey: 'carColor.cyan' },
];

export function carColorByKey(key: string | undefined): CarColorOption | undefined {
  return CAR_COLORS.find((c) => c.key === key);
}

export function carColorByHex(hex: string | undefined): CarColorOption | undefined {
  if (!hex) return undefined;
  const normalized = hex.trim().toUpperCase();
  return CAR_COLORS.find((c) => c.hex.toUpperCase() === normalized);
}

export function resolveCarColorKey(
  colorKey: string | undefined,
  colorHex: string | undefined
): string {
  if (colorKey && carColorByKey(colorKey)) return colorKey;
  return carColorByHex(colorHex)?.key ?? 'red';
}
