import { Router } from 'express';
import { z } from 'zod';
import { db, transaction } from '../db.js';
import { mapChampionship, mapRace, mapRaceResult } from '../mappers.js';
import { requireWrite } from '../middleware/auth.js';
import { championshipStandings, hall, progression, seriesChampions, standings, titleWins } from '../analytics/standings.js';

export const championshipsRouter=Router();
const calendar=z.array(z.object({roundNumber:z.number().int().positive(),trackId:z.string().uuid().optional().nullable()})).min(1);
const create=z.object({name:z.string().min(1),season:z.string().min(1),associationId:z.string().uuid().optional(),scoringSystemId:z.string().uuid().optional(),pointSystem:z.array(z.number().int()),useGarage:z.boolean(),useEvents:z.boolean(),usePress:z.boolean(),useSponsorship:z.boolean(),successionOfId:z.string().uuid().optional(),calendar});
const update=create.omit({successionOfId:true,calendar:true}).extend({seriesId:z.string().uuid().optional(),editionNumber:z.number().int().positive().optional(),isActive:z.boolean()});

championshipsRouter.get('/active',async(_q,res)=>res.json((await db.query('select * from championships where is_active order by created_at desc')).rows.map(mapChampionship)));
championshipsRouter.get('/standings/overall',async(_q,res)=>res.json(await standings()));
championshipsRouter.get('/hall',async(_q,res)=>res.json(await hall()));
championshipsRouter.get('/titles/driver/:driverId',async(req,res)=>res.json(await titleWins({driverId:req.params.driverId})));
championshipsRouter.get('/titles/car/:carId',async(req,res)=>res.json(await titleWins({carId:req.params.carId})));
championshipsRouter.get('/series/:seriesId/champions',async(req,res)=>res.json(await seriesChampions(req.params.seriesId)));
championshipsRouter.get('/series/:seriesId',async(req,res)=>res.json((await db.query('select * from championships where series_id=$1 order by edition_number desc',[req.params.seriesId])).rows.map(mapChampionship)));
championshipsRouter.post('/results-by-race-ids',async(req,res)=>{const ids=z.object({raceIds:z.array(z.string().uuid())}).parse(req.body).raceIds;if(!ids.length)return res.json({});const rows=(await db.query('select * from race_results where race_id=any($1::uuid[]) order by position',[ids])).rows.map(mapRaceResult);const out:Record<string,any[]>={};for(const id of ids)out[id]=[];for(const row of rows)out[row.raceId]!.push(row);res.json(out);});
championshipsRouter.patch('/races/:raceId/track',requireWrite,async(req,res)=>{const {trackId}=z.object({trackId:z.string().uuid().nullable()}).parse(req.body);const row=(await db.query("update races set track_id=$1 where id=$2 and status='planned' returning *",[trackId,req.params.raceId])).rows[0];return row?res.json(mapRace(row)):res.status(404).json({error:'Planned race not found.'});});

championshipsRouter.get('/',async(_q,res)=>res.json((await db.query('select * from championships order by finished_at desc nulls first, created_at desc')).rows.map(mapChampionship)));
championshipsRouter.post('/',requireWrite,async(req,res)=>{const v=create.parse(req.body);const result=await transaction(async client=>{
  let seriesId:string|undefined,edition=1;if(v.successionOfId){const previous=(await client.query('select * from championships where id=$1',[v.successionOfId])).rows[0];if(!previous)throw Object.assign(new Error('Previous championship not found.'),{status:404});seriesId=previous.series_id;edition=Number((await client.query('select coalesce(max(edition_number),0)+1 n from championships where series_id=$1',[seriesId])).rows[0].n);await client.query('update championships set is_active=false,finished_at=coalesce(finished_at,now()) where id=$1',[v.successionOfId]);}
  const row=(await client.query(`insert into championships(name,season,series_id,edition_number,point_system,use_garage,use_events,use_press,use_sponsorship,association_id,scoring_system_id)
  values($1,$2,coalesce($3,gen_random_uuid()),$4,$5,$6,$7,$8,$9,$10,$11) returning *`,[v.name,v.season,seriesId??null,edition,v.pointSystem,v.useGarage,v.useEvents,v.usePress,v.useSponsorship,v.associationId??null,v.scoringSystemId??null])).rows[0];
  for(const round of v.calendar)await client.query("insert into races(championship_id,track_id,round_number,race_type,status) values($1,$2,$3,'championship','planned')",[row.id,round.trackId??null,round.roundNumber]);
  return mapChampionship(row);});res.status(201).json(result);});
championshipsRouter.get('/:id/races/planned',async(req,res)=>res.json((await db.query("select * from races where championship_id=$1 and status='planned' order by round_number",[req.params.id])).rows.map(mapRace)));
championshipsRouter.get('/:id/races',async(req,res)=>res.json((await db.query('select * from races where championship_id=$1 order by round_number',[req.params.id])).rows.map(mapRace)));
championshipsRouter.get('/:id/standings',async(req,res)=>res.json(await championshipStandings(req.params.id)));
championshipsRouter.get('/:id/progression',async(req,res)=>res.json(await progression(req.params.id)));
championshipsRouter.post('/:id/rounds',requireWrite,async(req,res)=>{const rounds=z.object({rounds:calendar}).parse(req.body).rounds;const exists=(await db.query('select 1 from championships where id=$1',[req.params.id])).rowCount;if(!exists)return res.status(404).json({error:'Championship not found.'});for(const r of rounds)await db.query("insert into races(championship_id,track_id,round_number,race_type,status) values($1,$2,$3,'championship','planned')",[req.params.id,r.trackId??null,r.roundNumber]);res.status(204).end();});
championshipsRouter.post('/:id/finalize',requireWrite,async(req,res)=>{const row=(await db.query('update championships set is_active=false,finished_at=now() where id=$1 returning *',[req.params.id])).rows[0];return row?res.json(mapChampionship(row)):res.status(404).json({error:'Championship not found.'});});
championshipsRouter.get('/:id',async(req,res)=>{const row=(await db.query('select * from championships where id=$1',[req.params.id])).rows[0];return row?res.json(mapChampionship(row)):res.status(404).json({error:'Championship not found.'});});
championshipsRouter.put('/:id',requireWrite,async(req,res)=>{const v=update.parse(req.body);const row=(await db.query(`update championships set name=$1,season=$2,series_id=coalesce($3,series_id),edition_number=coalesce($4,edition_number),point_system=$5,use_garage=$6,use_events=$7,use_press=$8,use_sponsorship=$9,is_active=$10,association_id=$11,scoring_system_id=$12 where id=$13 returning *`,[v.name,v.season,v.seriesId??null,v.editionNumber??null,v.pointSystem,v.useGarage,v.useEvents,v.usePress,v.useSponsorship,v.isActive,v.associationId??null,v.scoringSystemId??null,req.params.id])).rows[0];return row?res.json(mapChampionship(row)):res.status(404).json({error:'Championship not found.'});});
championshipsRouter.delete('/:id',requireWrite,async(req,res)=>{const r=await db.query('delete from championships where id=$1',[req.params.id]);return r.rowCount?res.status(204).end():res.status(404).json({error:'Championship not found.'});});
