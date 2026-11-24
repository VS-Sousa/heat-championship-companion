import { Router } from 'express';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { db, transaction } from '../db.js';
import { mapChampionship, mapChampionshipEntry, mapRace, mapRaceResult } from '../mappers.js';
import { requireWrite } from '../middleware/auth.js';
import { championshipStandings, constructorStandings, hall, previousSeriesChampionDriverId, progression, seriesChampions, standings, titleFight, titleWins } from '../analytics/standings.js';

export const championshipsRouter=Router();
const calendar=z.array(z.object({roundNumber:z.number().int().positive(),trackId:z.string().uuid().optional().nullable()})).min(1);
const create=z.object({name:z.string().min(1),season:z.string().min(1),scoringSystemId:z.string().uuid(),carIds:z.array(z.string().uuid()).min(1),pointSystem:z.array(z.number().int()).optional(),useGarage:z.boolean(),useEvents:z.boolean(),usePress:z.boolean(),useSponsorship:z.boolean(),successionOfId:z.string().uuid().optional(),calendar});
const entryBody=z.object({driverId:z.string().uuid(),carId:z.string().uuid(),number:z.number().int().min(0).max(99),abbreviation:z.string().trim().length(3),garageUpgradeIds:z.array(z.string().uuid()).optional()});
const httpError=(status:number,message:string)=>Object.assign(new Error(message),{status});
async function entryWithUpgrades(client:PoolClient,entryId:string){
  const row=(await client.query('select * from championship_entries where id=$1',[entryId])).rows[0];
  if(!row)throw httpError(404,'Championship entry not found.');
  const ups=(await client.query('select garage_upgrade_id from championship_entry_upgrades where entry_id=$1',[entryId])).rows.map(r=>String(r.garage_upgrade_id));
  return mapChampionshipEntry(row,ups);
}
async function replaceUpgrades(client:PoolClient,entryId:string,ids:string[]){
  const unique=[...new Set(ids)];
  await client.query('delete from championship_entry_upgrades where entry_id=$1',[entryId]);
  for(const id of unique)await client.query('insert into championship_entry_upgrades(entry_id,garage_upgrade_id) values($1,$2)',[entryId,id]);
}
const update=create.omit({successionOfId:true,calendar:true,carIds:true}).extend({seriesId:z.string().uuid().optional(),editionNumber:z.number().int().positive().optional(),isActive:z.boolean()});

championshipsRouter.get('/active',async(_q,res)=>res.json((await db.query('select * from championships where is_active order by created_at desc')).rows.map(mapChampionship)));
championshipsRouter.get('/standings/overall',async(_q,res)=>res.json(await standings()));
championshipsRouter.get('/hall',async(_q,res)=>res.json(await hall()));
championshipsRouter.get('/titles/driver/:driverId',async(req,res)=>res.json(await titleWins({driverId:req.params.driverId})));
championshipsRouter.get('/titles/car/:carId',async(req,res)=>res.json(await titleWins({carId:req.params.carId})));
championshipsRouter.get('/series/:seriesId/champions',async(req,res)=>res.json(await seriesChampions(req.params.seriesId)));
championshipsRouter.get('/series/:seriesId/previous-champion',async(req,res)=>{const before=z.coerce.number().int().parse(req.query.beforeEdition);res.json({driverId:await previousSeriesChampionDriverId(String(req.params.seriesId),before)});});
championshipsRouter.get('/series/:seriesId',async(req,res)=>res.json((await db.query('select * from championships where series_id=$1 order by edition_number desc',[req.params.seriesId])).rows.map(mapChampionship)));
championshipsRouter.post('/results-by-race-ids',async(req,res)=>{const ids=z.object({raceIds:z.array(z.string().uuid())}).parse(req.body).raceIds;if(!ids.length)return res.json({});const rows=(await db.query('select * from race_results where race_id=any($1::uuid[]) order by position',[ids])).rows.map(mapRaceResult);const out:Record<string,any[]>={};for(const id of ids)out[id]=[];for(const row of rows)out[row.raceId]!.push(row);res.json(out);});
championshipsRouter.patch('/races/:raceId/track',requireWrite,async(req,res)=>{const {trackId}=z.object({trackId:z.string().uuid().nullable()}).parse(req.body);const row=(await db.query("update races set track_id=$1 where id=$2 and status='planned' returning *",[trackId,req.params.raceId])).rows[0];return row?res.json(mapRace(row)):res.status(404).json({error:'Planned race not found.'});});

championshipsRouter.get('/',async(_q,res)=>res.json((await db.query('select * from championships order by finished_at desc nulls first, created_at desc')).rows.map(mapChampionship)));
championshipsRouter.post('/',requireWrite,async(req,res)=>{const v=create.parse(req.body);const result=await transaction(async client=>{
  let seriesId:string|undefined,edition=1;if(v.successionOfId){const previous=(await client.query('select * from championships where id=$1',[v.successionOfId])).rows[0];if(!previous)throw Object.assign(new Error('Previous championship not found.'),{status:404});seriesId=previous.series_id;edition=Number((await client.query('select coalesce(max(edition_number),0)+1 n from championships where series_id=$1',[seriesId])).rows[0].n);await client.query('update championships set is_active=false,finished_at=coalesce(finished_at,now()) where id=$1',[v.successionOfId]);}
  let pointSystem=v.pointSystem;if(!pointSystem?.length){const scoring=(await client.query('select points from scoring_systems where id=$1',[v.scoringSystemId])).rows[0];if(!scoring)throw httpError(404,'Scoring system not found.');pointSystem=(scoring.points as unknown[]).map(Number);}
  const row=(await client.query(`insert into championships(name,season,series_id,edition_number,point_system,use_garage,use_events,use_press,use_sponsorship,scoring_system_id)
  values($1,$2,coalesce($3,gen_random_uuid()),$4,$5,$6,$7,$8,$9,$10) returning *`,[v.name,v.season,seriesId??null,edition,pointSystem,v.useGarage,v.useEvents,v.usePress,v.useSponsorship,v.scoringSystemId])).rows[0];
  for(const carId of new Set(v.carIds))await client.query('insert into championship_cars(championship_id,car_id) values($1,$2)',[row.id,carId]);
  for(const round of v.calendar)await client.query("insert into races(championship_id,track_id,round_number,race_type,status) values($1,$2,$3,'championship','planned')",[row.id,round.trackId??null,round.roundNumber]);
  return mapChampionship(row);});res.status(201).json(result);});
championshipsRouter.get('/:id/races/planned',async(req,res)=>res.json((await db.query("select * from races where championship_id=$1 and status='planned' order by round_number",[req.params.id])).rows.map(mapRace)));
championshipsRouter.get('/:id/races',async(req,res)=>res.json((await db.query('select * from races where championship_id=$1 order by round_number',[req.params.id])).rows.map(mapRace)));
championshipsRouter.get('/:id/standings',async(req,res)=>res.json(await championshipStandings(req.params.id)));
championshipsRouter.get('/:id/progression',async(req,res)=>res.json(await progression(req.params.id)));
championshipsRouter.get('/:id/constructor-standings',async(req,res)=>res.json(await constructorStandings(req.params.id)));
championshipsRouter.get('/:id/title-fight',async(req,res)=>res.json(await titleFight(req.params.id)));
championshipsRouter.get('/:id/cars',async(req,res)=>res.json((await db.query('select car_id from championship_cars where championship_id=$1',[req.params.id])).rows.map(r=>String(r.car_id))));
championshipsRouter.get('/:id/entries',async(req,res)=>{
  const rows=(await db.query('select * from championship_entries where championship_id=$1 order by number',[req.params.id])).rows;
  const ups=rows.length?(await db.query('select entry_id,garage_upgrade_id from championship_entry_upgrades where entry_id=any($1::uuid[])',[rows.map(r=>r.id)])).rows:[];
  const byEntry=new Map<string,string[]>();for(const u of ups){const k=String(u.entry_id);byEntry.set(k,[...(byEntry.get(k)??[]),String(u.garage_upgrade_id)]);}
  res.json(rows.map(r=>mapChampionshipEntry(r,byEntry.get(String(r.id))??[])));
});
// Upsert one entry per (championship, driver).
championshipsRouter.put('/:id/entries',requireWrite,async(req,res)=>{
  const v=entryBody.parse(req.body),championshipId=req.params.id,abbreviation=v.abbreviation.toUpperCase();
  const entry=await transaction(async c=>{
    if(!(await c.query('select 1 from championships where id=$1',[championshipId])).rowCount)throw httpError(404,'Championship not found.');
    if(!(await c.query('select 1 from championship_cars where championship_id=$1 and car_id=$2',[championshipId,v.carId])).rowCount)throw httpError(400,'Car is not part of this championship.');
    const existing=(await c.query('select id from championship_entries where championship_id=$1 and driver_id=$2',[championshipId,v.driverId])).rows[0];
    const saved=existing
      ?(await c.query('update championship_entries set car_id=$1,number=$2,abbreviation=$3 where id=$4 returning *',[v.carId,v.number,abbreviation,existing.id])).rows[0]
      :(await c.query('insert into championship_entries(championship_id,driver_id,car_id,number,abbreviation) values($1,$2,$3,$4,$5) returning *',[championshipId,v.driverId,v.carId,v.number,abbreviation])).rows[0];
    if(v.garageUpgradeIds)await replaceUpgrades(c,saved.id,v.garageUpgradeIds);
    return entryWithUpgrades(c,saved.id);
  });
  res.json(entry);
});
championshipsRouter.delete('/:id/entries/:entryId',requireWrite,async(req,res)=>{const r=await db.query('delete from championship_entries where id=$1 and championship_id=$2',[req.params.entryId,req.params.id]);return r.rowCount?res.status(204).end():res.status(404).json({error:'Championship entry not found.'});});
championshipsRouter.put('/:id/entries/:entryId/upgrades',requireWrite,async(req,res)=>{
  const ids=z.object({garageUpgradeIds:z.array(z.string().uuid())}).parse(req.body).garageUpgradeIds;
  const entry=await transaction(async c=>{
    const ch=(await c.query('select is_active,finished_at from championships where id=$1',[req.params.id])).rows[0];
    if(!ch)throw httpError(404,'Championship not found.');
    if(!ch.is_active||ch.finished_at)throw httpError(400,'Garage upgrades are locked once a championship is finalized.');
    if(!(await c.query('select 1 from championship_entries where id=$1 and championship_id=$2',[req.params.entryId,req.params.id])).rowCount)throw httpError(404,'Championship entry not found.');
    await replaceUpgrades(c,String(req.params.entryId),ids);
    return entryWithUpgrades(c,String(req.params.entryId));
  });
  res.json(entry);
});
championshipsRouter.post('/:id/rounds',requireWrite,async(req,res)=>{const rounds=z.object({rounds:calendar}).parse(req.body).rounds;const exists=(await db.query('select 1 from championships where id=$1',[req.params.id])).rowCount;if(!exists)return res.status(404).json({error:'Championship not found.'});for(const r of rounds)await db.query("insert into races(championship_id,track_id,round_number,race_type,status) values($1,$2,$3,'championship','planned')",[req.params.id,r.trackId??null,r.roundNumber]);res.status(204).end();});
championshipsRouter.post('/:id/finalize',requireWrite,async(req,res)=>{const row=(await db.query('update championships set is_active=false,finished_at=now() where id=$1 returning *',[req.params.id])).rows[0];return row?res.json(mapChampionship(row)):res.status(404).json({error:'Championship not found.'});});
championshipsRouter.get('/:id',async(req,res)=>{const row=(await db.query('select * from championships where id=$1',[req.params.id])).rows[0];return row?res.json(mapChampionship(row)):res.status(404).json({error:'Championship not found.'});});
championshipsRouter.put('/:id',requireWrite,async(req,res)=>{const v=update.parse(req.body);const row=(await db.query(`update championships set name=$1,season=$2,series_id=coalesce($3,series_id),edition_number=coalesce($4,edition_number),point_system=coalesce($5,point_system),use_garage=$6,use_events=$7,use_press=$8,use_sponsorship=$9,is_active=$10,scoring_system_id=$11 where id=$12 returning *`,[v.name,v.season,v.seriesId??null,v.editionNumber??null,v.pointSystem,v.useGarage,v.useEvents,v.usePress,v.useSponsorship,v.isActive,v.scoringSystemId,req.params.id])).rows[0];return row?res.json(mapChampionship(row)):res.status(404).json({error:'Championship not found.'});});
championshipsRouter.delete('/:id',requireWrite,async(req,res)=>{const r=await db.query('delete from championships where id=$1',[req.params.id]);return r.rowCount?res.status(204).end():res.status(404).json({error:'Championship not found.'});});
