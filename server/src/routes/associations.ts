import { Router } from 'express';
import { z } from 'zod';
import { db, transaction } from '../db.js';
import { mapAssociation } from '../mappers.js';
import { requireWrite } from '../middleware/auth.js';
export const associationsRouter = Router();
const body = z.object({ name: z.string().min(1) });
associationsRouter.get('/', async (_q,res)=>res.json((await db.query('select * from associations order by name')).rows.map(mapAssociation)));
associationsRouter.get('/:id/members', async (req,res)=>res.json((await db.query('select driver_id from association_members where association_id=$1',[req.params.id])).rows.map(x=>String(x.driver_id))));
associationsRouter.put('/:id/members',requireWrite,async(req,res)=>{
  const ids=[...new Set(z.object({driverIds:z.array(z.string().uuid())}).parse(req.body).driverIds)];
  await transaction(async c=>{
    if(!(await c.query('select 1 from associations where id=$1',[req.params.id])).rowCount)throw Object.assign(new Error('Association not found.'),{status:404});
    if(ids.length){
      const legends=(await c.query('select name from drivers where id=any($1::uuid[]) and is_legend',[ids])).rows;
      if(legends.length)throw Object.assign(new Error(`Legend drivers cannot be association members: ${legends.map(l=>l.name).join(', ')}.`),{status:400});
    }
    await c.query('delete from association_members where association_id=$1',[req.params.id]);
    for(const id of ids)await c.query('insert into association_members(association_id,driver_id) values($1,$2)',[req.params.id,id]);
  });
  res.status(204).end();
});
associationsRouter.get('/:id',async(req,res)=>{const r=(await db.query('select * from associations where id=$1',[req.params.id])).rows[0];return r?res.json(mapAssociation(r)):res.status(404).json({error:'Association not found.'});});
associationsRouter.post('/',requireWrite,async(req,res)=>{const v=body.parse(req.body);res.status(201).json(mapAssociation((await db.query('insert into associations(name) values($1) returning *',[v.name])).rows[0]));});
associationsRouter.put('/:id',requireWrite,async(req,res)=>{const v=body.parse(req.body);const r=(await db.query('update associations set name=$1 where id=$2 returning *',[v.name,req.params.id])).rows[0];return r?res.json(mapAssociation(r)):res.status(404).json({error:'Association not found.'});});
associationsRouter.delete('/:id',requireWrite,async(req,res)=>{await db.query('delete from associations where id=$1',[req.params.id]);res.status(204).end();});
