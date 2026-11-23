import { db } from '../db.js';
import { formatDriverName, mapCar, mapChampionship, mapDriver, mapRace, mapRaceResult } from '../mappers.js';

export async function standings(championshipId?: string) {
  const params = championshipId ? [championshipId] : [];
  const filter = championshipId ? 'and r.championship_id=$1' : '';
  const rows = (await db.query(`select rr.*,d.name,d.nickname,d.abbreviation,d.number
    from race_results rr join races r on r.id=rr.race_id
    join drivers d on d.id=rr.driver_id where r.status='completed' ${filter}`, params)).rows;
  const grouped = new Map<string, any>();
  for (const r of rows) {
    const item = grouped.get(r.driver_id) ?? {
      driverId: r.driver_id, driverName: r.name, nickname: r.nickname ?? undefined,
      abbreviation: r.abbreviation, number: r.number, points: 0, wins: 0, podiums: 0, races: 0,
    };
    item.points += r.points_awarded; item.races++;
    if (!r.dnf && r.position === 1) item.wins++;
    if (!r.dnf && r.position <= 3) item.podiums++;
    grouped.set(r.driver_id, item);
  }
  return [...grouped.values()].sort((a, b) => b.points-a.points || b.wins-a.wins || a.driverName.localeCompare(b.driverName));
}

export async function championshipStandings(id: string) {
  const championshipRow = (await db.query('select * from championships where id=$1', [id])).rows[0];
  if (!championshipRow) return [];
  const championship = mapChampionship(championshipRow);
  const rows = await standings(id);
  const planned = Number((await db.query("select count(*) from races where championship_id=$1 and status='planned'", [id])).rows[0].count);
  const maximum = Math.max(...championship.pointSystem, 0);
  const leader = rows[0]?.points ?? 0;
  return rows.map(row => ({ ...row, inTitleFight: planned === 0 ? row.points === leader : row.points + planned * maximum >= leader }));
}

export async function progression(id: string) {
  const races = (await db.query("select * from races where championship_id=$1 and status='completed' order by round_number", [id])).rows.map(mapRace);
  if (!races.length) return { rounds: [], series: [] };
  const [resultRows, driverRows, carRows] = await Promise.all([
    db.query('select * from race_results where race_id=any($1::uuid[])', [races.map(r => r.id)]),
    db.query('select * from drivers'), db.query('select * from cars'),
  ]);
  const results = resultRows.rows.map(mapRaceResult), drivers = driverRows.rows.map(mapDriver), cars = carRows.rows.map(mapCar);
  const totals = new Map<string, number>(), points = new Map<string, number[]>(), finishes = new Map<string, (number|null)[]>(), dnfs = new Map<string, boolean[]>(), usage = new Map<string, Map<string,number>>();
  races.forEach((race, index) => {
    const round = results.filter(r => r.raceId === race.id);
    for (const r of round) {
      totals.set(r.driverId, (totals.get(r.driverId) ?? 0) + r.pointsAwarded);
      const u = usage.get(r.driverId) ?? new Map(); u.set(r.carId, (u.get(r.carId) ?? 0)+1); usage.set(r.driverId,u);
      if (!points.has(r.driverId)) { points.set(r.driverId, Array(index).fill(0)); finishes.set(r.driverId, Array(index).fill(null)); dnfs.set(r.driverId, Array(index).fill(false)); }
    }
    for (const [driverId,total] of totals) {
      const rr = round.find(r => r.driverId === driverId);
      points.get(driverId)!.push(total); finishes.get(driverId)!.push(rr?.position ?? null); dnfs.get(driverId)!.push(rr?.dnf ?? false);
    }
  });
  const palette = ['#E1221C','#0067AD','#F8D400','#00A19C','#6B3FA0','#FF6B00'];
  const series = [...totals].map(([driverId], index) => {
    const d = drivers.find(x => x.id === driverId)!;
    const bestCar = [...(usage.get(driverId) ?? [])].sort((a,b)=>b[1]-a[1])[0]?.[0];
    const pad = <T>(a:T[], fill:T) => [...a,...Array(races.length-a.length).fill(fill)];
    const p = points.get(driverId)!;
    return { driverId, driverName:d.name, nickname:d.nickname, abbreviation:d.abbreviation, number:d.number,
      color:cars.find(c=>c.id===bestCar)?.colorHex ?? palette[index%palette.length],
      pointsAfterRound:pad(p,p.at(-1)??0), finishPositionByRound:pad(finishes.get(driverId)!,null),
      dnfByRound:pad(dnfs.get(driverId)!,false) };
  }).sort((a,b)=>(b.pointsAfterRound.at(-1)??0)-(a.pointsAfterRound.at(-1)??0));
  return { rounds:races.map(r=>({raceId:r.id,roundNumber:r.roundNumber??0,trackId:r.trackId})), series };
}

async function bestCar(championshipId:string, driverId:string) {
  const row=(await db.query(`select c.id,c.name,c.color_hex,sum(rr.points_awarded) points from race_results rr
    join races r on r.id=rr.race_id join cars c on c.id=rr.car_id
    where r.championship_id=$1 and r.status='completed' and rr.driver_id=$2
    group by c.id order by points desc limit 1`,[championshipId,driverId])).rows[0];
  return row && { carId:row.id, carName:row.name, carColorHex:row.color_hex };
}

export async function seriesChampions(seriesId:string) {
  const editions=(await db.query('select * from championships where series_id=$1 order by edition_number desc',[seriesId])).rows.map(mapChampionship);
  return Promise.all(editions.map(async c => {
    const base={championshipId:c.id,championshipName:c.name,season:c.season,editionNumber:c.editionNumber,finishedAt:c.finishedAt};
    if (c.isActive && !c.finishedAt) return base;
    const champion=(await standings(c.id))[0]; if (!champion) return base;
    return {...base,driverId:champion.driverId,driverName:formatDriverName({name:champion.driverName,nickname:champion.nickname}),nickname:champion.nickname,...await bestCar(c.id,champion.driverId),points:champion.points};
  }));
}

export async function titleWins(filter?:{driverId?:string;carId?:string}) {
  const champs=(await db.query("select * from championships where not is_active or finished_at is not null order by edition_number")).rows.map(mapChampionship);
  const wins:any[]=[];
  for(const c of champs){ const champion=(await standings(c.id))[0]; if(!champion)continue; const car=await bestCar(c.id,champion.driverId);
    if(filter?.driverId && champion.driverId!==filter.driverId)continue;
    if(filter?.carId && car?.carId!==filter.carId)continue;
    wins.push({championshipId:c.id,championshipName:c.name,season:c.season,editionNumber:c.editionNumber,...car,driverId:champion.driverId,driverName:champion.driverName});
  }
  return wins.sort((a,b)=>b.editionNumber-a.editionNumber);
}

export async function hall() {
  const drivers=(await db.query('select * from drivers')).rows.map(mapDriver), tally=new Map<string,any>();
  for(const win of await titleWins()){const t=tally.get(win.driverId)??{titles:0};t.titles++;t.lastTitleSeason=win.season;t.lastTitleCarName=win.carName;tally.set(win.driverId,t);}
  return drivers.filter(d=>tally.has(d.id)).map(d=>({driverId:d.id,driverName:formatDriverName(d),nickname:d.nickname,abbreviation:d.abbreviation,number:d.number,isLegend:d.isLegend,...tally.get(d.id)})).sort((a,b)=>b.titles-a.titles);
}
