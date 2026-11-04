export function formatDriverName(driver: {
  name?: string;
  driverName?: string;
  nickname?: string;
}): string {
  const name = (driver.name ?? driver.driverName ?? '').trim();
  const nick = driver.nickname?.trim();
  return nick ? `${name} (${nick})` : name;
}
