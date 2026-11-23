import { db } from '../db.js';
import { formatDriverName, mapCar, mapDriver } from '../mappers.js';

async function history(filter: {driverId?:string;carId?:string;trackId?:string}) {
  const values: string[]=[]; const conditions=["r.status='completed'"];
  for(const [column,value] of [['rr.driver_id',filter.driverId],['rr.car_id',filter.carId],['r.track_id',filter.trackId]] as const)
    if(value){values.push(value);conditions.push(`${column}=$${values.length}`);}
  const rows=(await db.query(`select rr.*,r.raced_at,r.track_id,r.championship_id,t.name track_name,
    ch.name championship_name,d.name driver_name,d.nickname,c.name car_name,c.color_hex
    from race_results rr join races r on r.id=rr.race_id join drivers d on d.id=rr.driver_id
    join cars c on c.id=rr.car_id left join tracks t on t.id=r.track_id
    left join championships ch on ch.id=r.championship_id where ${conditions.join(' and ')}
    order by r.raced_at desc nulls last`,values)).rows;
  return rows.map(r=>({raceId:r.race_id,racedAt:r.raced_at?String(r.raced_at):undefined,trackId:r.track_id??undefined,
    trackName:r.track_name??undefined,championshipId:r.championship_id??undefined,championshipName:r.championship_name??undefined,
    driverId:r.driver_id,driverName:formatDriverName({name:r.driver_name,nickname:r.nickname}),carId:r.car_id,carName:r.car_name,
    carColorHex:r.color_hex,gridPosition:r.grid_position,position:r.position,pointsAwarded:r.points_awarded,dnf:r.dnf}));
}
export const driverHistory=(id:string)=>history({driverId:id});
export const carHistory=(id:string)=>history({carId:id});

function breakdown(rows:Awaited<ReturnType<typeof history>>, key:(r:any)=>{id:string;label:string;colorHex?:string}) {
  const groups=new Map<string,any>();
  for(const r of rows){const k=key(r),v=groups.get(k.id)??{...k,races:0,wins:0,podiums:0,points:0,avgFinish:null,bestFinish:null,sum:0,count:0};
    v.races++;v.points+=r.pointsAwarded;if(!r.dnf){v.sum+=r.position;v.count++;v.bestFinish=v.bestFinish===null?r.position:Math.min(v.bestFinish,r.position);if(r.position===1)v.wins++;if(r.position<=3)v.podiums++;}groups.set(k.id,v);}
  return [...groups.values()].map(({sum,count,...v})=>({...v,avgFinish:count?sum/count:null})).sort((a,b)=>b.points-a.points||b.wins-a.wins);
}
export const driverByCar=async(id:string)=>breakdown(await driverHistory(id),r=>({id:r.carId,label:r.carName,colorHex:r.carColorHex}));
export const driverByTrack=async(id:string)=>breakdown(await driverHistory(id),r=>({id:r.trackId??'unknown',label:r.trackName??'—'}));
export const carByDriver=async(id:string)=>breakdown(await carHistory(id),r=>({id:r.driverId,label:r.driverName}));
export const carByTrack=async(id:string)=>breakdown(await carHistory(id),r=>({id:r.trackId??'unknown',label:r.trackName??'—'}));

export async function driverStats(){
  const [drivers,rows]=await Promise.all([db.query('select * from drivers'),history({})]);
  return drivers.rows.map(mapDriver).map(d=>{const all=rows.filter(r=>r.driverId===d.id),finished=all.filter(r=>!r.dnf);return{
    driverId:d.id,driverName:formatDriverName(d),nickname:d.nickname,abbreviation:d.abbreviation,number:d.number,isLegend:d.isLegend,
    races:all.length,wins:finished.filter(r=>r.position===1).length,podiums:finished.filter(r=>r.position<=3).length,
    points:all.reduce((s,r)=>s+r.pointsAwarded,0),dnfs:all.filter(r=>r.dnf).length,
    avgFinish:finished.length?finished.reduce((s,r)=>s+r.position,0)/finished.length:null};}).sort((a,b)=>b.points-a.points||b.wins-a.wins);
}
export async function carStats(){
  const [cars,rows]=await Promise.all([db.query('select * from cars'),history({})]);
  return cars.rows.map(mapCar).map(c=>{const all=rows.filter(r=>r.carId===c.id),finished=all.filter(r=>!r.dnf);return{
    carId:c.id,carName:c.name,colorHex:c.colorHex,races:all.length,wins:finished.filter(r=>r.position===1).length,
    podiums:finished.filter(r=>r.position<=3).length,dnfs:all.filter(r=>r.dnf).length};}).sort((a,b)=>b.wins-a.wins||b.races-a.races);
}
export async function trackDrivers(id:string){const rows=await history({trackId:id}),groups=new Map<string,any>();
  for(const r of rows){const v=groups.get(r.driverId)??{driverId:r.driverId,driverName:r.driverName,races:0,wins:0,podiums:0,avgFinish:null,bestFinish:null,sum:0,count:0};
    v.races++;if(!r.dnf){v.sum+=r.position;v.count++;v.bestFinish=v.bestFinish===null?r.position:Math.min(v.bestFinish,r.position);if(r.position===1)v.wins++;if(r.position<=3)v.podiums++;}groups.set(r.driverId,v);}
  return [...groups.values()].map(({sum,count,...v})=>({...v,avgFinish:count?sum/count:null})).sort((a,b)=>b.wins-a.wins||b.races-a.races);}
export async function headToHead(id:string){const rows=await history({}),mine=rows.filter(r=>r.driverId===id),groups=new Map<string,any>();
  for(const m of mine)for(const o of rows.filter(r=>r.raceId===m.raceId&&r.driverId!==id)){const v=groups.get(o.driverId)??{opponentId:o.driverId,opponentName:o.driverName,wins:0,losses:0,draws:0},mp=m.dnf?999:m.position,op=o.dnf?999:o.position;mp<op?v.wins++:mp>op?v.losses++:v.draws++;groups.set(o.driverId,v);}
  return [...groups.values()].sort((a,b)=>b.wins-a.wins||a.losses-b.losses);}
export async function bestFinish(id:string){const rows=(await driverHistory(id)).filter(r=>!r.dnf).sort((a,b)=>a.position-b.position||String(b.racedAt??'').localeCompare(String(a.racedAt??'')));const r=rows[0];return r?{position:r.position,racedAt:r.racedAt,trackName:r.trackName}:null;}
