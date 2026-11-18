export function normalizeHex(hex: string): string {
  const value = hex.trim();
  if (!/^#?[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error('Invalid color. Use a hex value like #E1221C.');
  }
  return value.startsWith('#') ? value.toUpperCase() : `#${value.toUpperCase()}`;
}
