import { db } from '../db.js';
import { formatDriverName, mapCar, mapChampionship, mapDriver, mapRace, mapRaceResult } from '../mappers.js';
import {
  applyResultToStanding, emptyStandingRow, sortStandingRows, type StandingRow,
} from './standings-sort.js';
import { computeTitleContention } from './title-fight.js';

/** Races that still count towards the remaining calendar (not finished, not cancelled). */
const OPEN_RACE_STATUSES = ['planned', 'pre_race', 'in_race', 'post_race'];

/** Number/abbreviation are championship-scoped; display fallback for cross-championship views. */
export interface DriverIdentity { abbreviation: string; number: number }

export function fallbackIdentity(name: string): DriverIdentity {
  const letters = name.replace(/[^\p{L}]/gu, '').toUpperCase();
  return { abbreviation: (letters.slice(0, 3) || '???').padEnd(3, '?'), number: 0 };
}

/** Most recent championship entry identity per driver (by created_at). */
export async function latestIdentities(): Promise<Map<string, DriverIdentity>> {
  const rows = (await db.query(
    `select distinct on (driver_id) driver_id, number, abbreviation
     from championship_entries order by driver_id, created_at desc`)).rows;
  return new Map(rows.map(r => [String(r.driver_id), { abbreviation: String(r.abbreviation), number: Number(r.number) }]));
}

async function entryRows(championshipId: string) {
  return (await db.query('select * from championship_entries where championship_id=$1 order by number', [championshipId])).rows;
}

const identitiesFromEntries = (entries: any[]) =>
  new Map<string, DriverIdentity>(entries.map(e => [String(e.driver_id), { abbreviation: String(e.abbreviation), number: Number(e.number) }]));

/**
 * Standings sorted by points → P1 → P2 → P3 → most recent win.
 * Scoped to one championship (uses its entry number/abbreviation and seeds every entry),
 * or global when `championshipId` is omitted (uses the latest entry identity per driver).
 */
export async function standings(championshipId?: string): Promise<StandingRow[]> {
  const params = championshipId ? [championshipId] : [];
  const filter = championshipId ? 'and r.championship_id=$1' : '';
  const [results, driverRows, entries] = await Promise.all([
    db.query(`select rr.driver_id, rr.position, rr.points_awarded, r.round_number
      from race_results rr join races r on r.id=rr.race_id
      where r.status='completed' ${filter}`, params),
    db.query('select * from drivers'),
    championshipId ? entryRows(championshipId) : Promise.resolve([]),
  ]);
  const identities = championshipId ? identitiesFromEntries(entries) : await latestIdentities();
  const drivers = new Map(driverRows.rows.map(mapDriver).map(d => [d.id, d]));
  const byDriver = new Map<string, StandingRow>();

  const rowFor = (driverId: string) => {
    const existing = byDriver.get(driverId);
    if (existing) return existing;
    const driver = drivers.get(driverId);
    if (!driver) return null;
    const identity = identities.get(driverId) ?? fallbackIdentity(driver.name);
    const row = emptyStandingRow({ driverId, driverName: driver.name, nickname: driver.nickname, ...identity });
    byDriver.set(driverId, row);
    return row;
  };

  for (const e of entries) rowFor(String(e.driver_id));
  for (const r of results.rows) {
    const row = rowFor(String(r.driver_id));
    if (!row) continue;
    applyResultToStanding(row, { position: Number(r.position), pointsAwarded: Number(r.points_awarded) },
      r.round_number == null ? undefined : Number(r.round_number));
  }
  return sortStandingRows([...byDriver.values()]);
}

export const championshipStandings = async (id: string) =>
  (await db.query('select 1 from championships where id=$1', [id])).rowCount ? standings(id) : [];

export async function titleFight(id: string) {
  const championshipRow = (await db.query('select * from championships where id=$1', [id])).rows[0];
  if (!championshipRow) return [];
  const championship = mapChampionship(championshipRow);
  const [rows, entries, open] = await Promise.all([
    standings(id), entryRows(id),
    db.query('select count(*) from races where championship_id=$1 and status=any($2::text[])', [id, OPEN_RACE_STATUSES]),
  ]);
  return computeTitleContention({
    standings: rows,
    remainingPlanned: Number(open.rows[0].count),
    gridSize: Math.max(entries.length, rows.length),
    pointSystem: championship.pointSystem,
  });
}

export async function constructorStandings(id: string) {
  const [carRows, championshipCars, results] = await Promise.all([
    db.query('select * from cars'),
    db.query('select car_id from championship_cars where championship_id=$1', [id]),
    db.query(`select rr.car_id, rr.position, rr.points_awarded from race_results rr
      join races r on r.id=rr.race_id where r.championship_id=$1 and r.status='completed'`, [id]),
  ]);
  const cars = new Map(carRows.rows.map(mapCar).map(c => [c.id, c]));
  const byCar = new Map<string, { carId: string; carName: string; colorHex: string; points: number; wins: number; podiums: number; races: number }>();
  const rowFor = (carId: string) => {
    const existing = byCar.get(carId);
    if (existing) return existing;
    const car = cars.get(carId);
    if (!car) return null;
    const row = { carId, carName: car.name, colorHex: car.colorHex, points: 0, wins: 0, podiums: 0, races: 0 };
    byCar.set(carId, row);
    return row;
  };
  for (const r of championshipCars.rows) rowFor(String(r.car_id));
  for (const r of results.rows) {
    const row = rowFor(String(r.car_id));
    if (!row) continue;
    row.points += Number(r.points_awarded); row.races++;
    if (Number(r.position) === 1) row.wins++;
    if (Number(r.position) <= 3) row.podiums++;
  }
  return [...byCar.values()].sort((a, b) =>
    b.points - a.points || b.wins - a.wins || b.podiums - a.podiums || a.carName.localeCompare(b.carName));
}

export async function progression(id: string) {
  const races = (await db.query("select * from races where championship_id=$1 and status='completed' order by round_number", [id])).rows.map(mapRace);
  if (!races.length) return { rounds: [], series: [] };
  const [resultRows, driverRows, carRows, entries] = await Promise.all([
    db.query('select * from race_results where race_id=any($1::uuid[])', [races.map(r => r.id)]),
    db.query('select * from drivers'), db.query('select * from cars'), entryRows(id),
  ]);
  const results = resultRows.rows.map(mapRaceResult), drivers = driverRows.rows.map(mapDriver), cars = carRows.rows.map(mapCar);
  const identities = identitiesFromEntries(entries);
  const totals = new Map<string, number>(), points = new Map<string, number[]>(), finishes = new Map<string, (number|null)[]>(), usage = new Map<string, Map<string,number>>();
  races.forEach((race, index) => {
    const round = results.filter(r => r.raceId === race.id);
    for (const r of round) {
      totals.set(r.driverId, (totals.get(r.driverId) ?? 0) + r.pointsAwarded);
      const u = usage.get(r.driverId) ?? new Map(); u.set(r.carId, (u.get(r.carId) ?? 0)+1); usage.set(r.driverId,u);
      if (!points.has(r.driverId)) { points.set(r.driverId, Array(index).fill(0)); finishes.set(r.driverId, Array(index).fill(null)); }
    }
    for (const [driverId,total] of totals) {
      const rr = round.find(r => r.driverId === driverId);
      points.get(driverId)!.push(total); finishes.get(driverId)!.push(rr?.position ?? null);
    }
  });
  const palette = ['#E1221C','#0067AD','#F8D400','#00A19C','#6B3FA0','#FF6B00'];
  const series = [...totals].map(([driverId], index) => {
    const d = drivers.find(x => x.id === driverId)!;
    const identity = identities.get(driverId) ?? fallbackIdentity(d.name);
    const bestCar = [...(usage.get(driverId) ?? [])].sort((a,b)=>b[1]-a[1])[0]?.[0];
    const pad = <T>(a:T[], fill:T) => [...a,...Array(races.length-a.length).fill(fill)];
    const p = points.get(driverId)!;
    return { driverId, driverName:d.name, nickname:d.nickname, abbreviation:identity.abbreviation, number:identity.number,
      color:cars.find(c=>c.id===bestCar)?.colorHex ?? palette[index%palette.length],
      pointsAfterRound:pad(p,p.at(-1)??0), finishPositionByRound:pad(finishes.get(driverId)!,null) };
  }).sort((a,b)=>(b.pointsAfterRound.at(-1)??0)-(a.pointsAfterRound.at(-1)??0));
  return { rounds:races.map(r=>({raceId:r.id,roundNumber:r.roundNumber??0,trackId:r.trackId})), series };
}

/** Championship entries pin one car per driver; fall back to the most-scoring car. */
async function bestCar(championshipId:string, driverId:string) {
  const entryCar=(await db.query(`select c.id,c.name,c.color_hex from championship_entries e
    join cars c on c.id=e.car_id where e.championship_id=$1 and e.driver_id=$2`,[championshipId,driverId])).rows[0];
  const row=entryCar ?? (await db.query(`select c.id,c.name,c.color_hex,sum(rr.points_awarded) points from race_results rr
    join races r on r.id=rr.race_id join cars c on c.id=rr.car_id
    where r.championship_id=$1 and r.status='completed' and rr.driver_id=$2
    group by c.id order by points desc limit 1`,[championshipId,driverId])).rows[0];
  return row && { carId:row.id, carName:row.name, carColorHex:row.color_hex };
}

/** Leader only counts as champion once they have actually raced. */
async function championOf(championshipId:string) {
  const leader=(await standings(championshipId))[0];
  return leader && leader.races>0 ? leader : undefined;
}

export async function seriesChampions(seriesId:string) {
  const editions=(await db.query('select * from championships where series_id=$1 order by edition_number desc',[seriesId])).rows.map(mapChampionship);
  return Promise.all(editions.map(async c => {
    const base={championshipId:c.id,championshipName:c.name,season:c.season,editionNumber:c.editionNumber,finishedAt:c.finishedAt};
    if (c.isActive && !c.finishedAt) return base;
    const champion=await championOf(c.id); if (!champion) return base;
    return {...base,driverId:champion.driverId,driverName:formatDriverName({name:champion.driverName,nickname:champion.nickname}),nickname:champion.nickname,...await bestCar(c.id,champion.driverId),points:champion.points};
  }));
}

export async function previousSeriesChampionDriverId(seriesId:string, beforeEditionNumber:number): Promise<string|null> {
  const editions=(await db.query(
    'select * from championships where series_id=$1 and edition_number<$2 and (not is_active or finished_at is not null) order by edition_number desc',
    [seriesId,beforeEditionNumber])).rows.map(mapChampionship);
  for (const edition of editions) {
    const champion=await championOf(edition.id);
    if (champion) return champion.driverId;
  }
  return null;
}

export async function titleWins(filter?:{driverId?:string;carId?:string}) {
  const champs=(await db.query("select * from championships where not is_active or finished_at is not null order by edition_number")).rows.map(mapChampionship);
  const wins:any[]=[];
  for(const c of champs){ const champion=await championOf(c.id); if(!champion)continue; const car=await bestCar(c.id,champion.driverId);
    if(filter?.driverId && champion.driverId!==filter.driverId)continue;
    if(filter?.carId && car?.carId!==filter.carId)continue;
    wins.push({championshipId:c.id,championshipName:c.name,season:c.season,editionNumber:c.editionNumber,...car,driverId:champion.driverId,driverName:champion.driverName});
  }
  return wins.sort((a,b)=>b.editionNumber-a.editionNumber);
}

export async function hall() {
  const [driverRows,identities]=await Promise.all([db.query('select * from drivers'),latestIdentities()]);
  const drivers=driverRows.rows.map(mapDriver), tally=new Map<string,any>();
  for(const win of await titleWins()){const t=tally.get(win.driverId)??{titles:0};t.titles++;if(t.titles===1){t.lastTitleSeason=win.season;t.lastTitleCarName=win.carName;}tally.set(win.driverId,t);}
  return drivers.filter(d=>tally.has(d.id)).map(d=>{const identity=identities.get(d.id)??fallbackIdentity(d.name);return{driverId:d.id,driverName:formatDriverName(d),nickname:d.nickname,abbreviation:identity.abbreviation,number:identity.number,isLegend:d.isLegend,...tally.get(d.id)};}).sort((a,b)=>b.titles-a.titles);
}
