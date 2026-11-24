import { Router } from 'express'; import { z } from 'zod'; import { db } from '../db.js'; import { requireWrite } from '../middleware/auth.js'; import { mapGarageUpgrade as map } from '../mappers.js';
export const garageUpgradesRouter=Router();
const body=z.object({name:z.string().trim().min(1),description:z.string().default(''),set:z.enum(['basegame','heavy_rain','tunnel_vision','rocky_roads','homebrew'])});
garageUpgradesRouter.get('/',async(_q,res)=>res.json((await db.query('select * from garage_upgrades order by "set",name')).rows.map(map)));
garageUpgradesRouter.get('/:id',async(req,res)=>{const r=(await db.query('select * from garage_upgrades where id=$1',[req.params.id])).rows[0];return r?res.json(map(r)):res.status(404).json({error:'Upgrade not found.'});});
garageUpgradesRouter.post('/',requireWrite,async(req,res)=>{const v=body.parse(req.body);res.status(201).json(map((await db.query('insert into garage_upgrades(name,description,"set") values($1,$2,$3) returning *',[v.name,v.description,v.set])).rows[0]));});
garageUpgradesRouter.put('/:id',requireWrite,async(req,res)=>{const v=body.parse(req.body);const r=(await db.query('update garage_upgrades set name=$1,description=$2,"set"=$3 where id=$4 returning *',[v.name,v.description,v.set,req.params.id])).rows[0];return r?res.json(map(r)):res.status(404).json({error:'Upgrade not found.'});});
garageUpgradesRouter.delete('/:id',requireWrite,async(req,res)=>{await db.query('delete from garage_upgrades where id=$1',[req.params.id]);res.status(204).end();});
