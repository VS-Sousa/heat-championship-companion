import { Router } from 'express'; import { z } from 'zod'; import { db } from '../db.js'; import { requireWrite } from '../middleware/auth.js';
export const garageUpgradesRouter=Router();
const body=z.object({name:z.string().min(1),category:z.enum(['engine','suspension','brakes','tires','cooling','other']),heatCost:z.number().int().nonnegative(),effect:z.string()});
const map=(r:any)=>({id:String(r.id),name:r.name,category:r.category,heatCost:Number(r.heat_cost),effect:r.effect});
garageUpgradesRouter.get('/',async(_q,res)=>res.json((await db.query('select * from garage_upgrades order by heat_cost,name')).rows.map(map)));
garageUpgradesRouter.get('/:id',async(req,res)=>{const r=(await db.query('select * from garage_upgrades where id=$1',[req.params.id])).rows[0];return r?res.json(map(r)):res.status(404).json({error:'Upgrade not found.'});});
garageUpgradesRouter.post('/',requireWrite,async(req,res)=>{const v=body.parse(req.body);res.status(201).json(map((await db.query('insert into garage_upgrades(name,category,heat_cost,effect) values($1,$2,$3,$4) returning *',[v.name,v.category,v.heatCost,v.effect])).rows[0]));});
garageUpgradesRouter.put('/:id',requireWrite,async(req,res)=>{const v=body.parse(req.body);const r=(await db.query('update garage_upgrades set name=$1,category=$2,heat_cost=$3,effect=$4 where id=$5 returning *',[v.name,v.category,v.heatCost,v.effect,req.params.id])).rows[0];return r?res.json(map(r)):res.status(404).json({error:'Upgrade not found.'});});
garageUpgradesRouter.delete('/:id',requireWrite,async(req,res)=>{await db.query('delete from garage_upgrades where id=$1',[req.params.id]);res.status(204).end();});
